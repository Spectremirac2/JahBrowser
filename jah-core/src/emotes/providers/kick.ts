import type { NetworkBridge } from '../../engine/types.js';
import type { Emote, EmoteProvider } from '../types.js';
import { asIdString, asString, isRecord, mapDefensively, parseChannelKey } from './helpers.js';

/**
 * Kick native channel emote provider.
 *
 * Kick has NO officially documented public emote endpoint (dev.kick.com does
 * not cover emote listings as of 2026-07, and the site endpoint community
 * tools use sits behind Cloudflare). Following the "Kick Plus" architecture
 * (same pattern as KickChatConfig in platform/kick/chat.ts), every endpoint
 * is injected via remotely updatable config — never hardcoded — so a
 * Kick-side change never requires a binary update.
 *
 * The parser is deliberately shape-tolerant. It accepts the response shapes
 * community tools have observed from Kick:
 *   1. An array of groups:
 *        [{ id: <channelId>, user_id, slug, emotes: [{ id, channel_id, name,
 *           subscribers_only }] },
 *         { id: "Global", emotes: [...] }, { id: "Emoji", emotes: [...] }]
 *   2. A bare array of emote objects: [{ id, name }, ...]
 *   3. An object wrapper: { emotes: [...] }
 * Anything else parses to [] — a malformed payload must never crash chat.
 * Network errors still propagate (EmoteEngine .catch()es per provider).
 */
export interface KickEmoteConfig {
  /**
   * Channel emote listing url template with a `{channel}` placeholder
   * (slug or id, passed through from the channelKey), e.g.
   * "https://kick.example/emotes/{channel}". Empty/missing disables the
   * provider (remote config not yet delivered).
   */
  channelEmotesUrlTemplate?: string;
  /**
   * CDN url template with `{id}` and optional `{size}` placeholders, e.g.
   * "https://files.kick.com/emotes/{id}/fullsize". With `{size}` present,
   * urls are emitted for 1x..4x; without it a single '1x' url is emitted.
   */
  emoteCdnUrlTemplate?: string;
  /** Optional global emote listing url; absent -> no global emotes. */
  globalEmotesUrl?: string;
}

/** Group ids Kick uses for non-channel emote groups in the grouped shape. */
const NON_CHANNEL_GROUP_IDS = new Set(['Global', 'Emoji']);

const CDN_SIZES = ['1x', '2x', '3x', '4x'] as const;

export class KickEmoteProvider implements EmoteProvider {
  readonly id = 'kick' as const;

  constructor(
    private readonly net: NetworkBridge,
    private readonly config: KickEmoteConfig,
  ) {}

  async fetchGlobalEmotes(): Promise<Emote[]> {
    const url = this.config.globalEmotesUrl;
    if (!url || !this.config.emoteCdnUrlTemplate) return [];
    const payload = await this.net.fetchJson<unknown>(url);
    return this.collectEmotes(payload, /* channelOnly */ false);
  }

  async fetchChannelEmotes(channelKey: string): Promise<Emote[]> {
    const template = this.config.channelEmotesUrlTemplate;
    if (!template || !this.config.emoteCdnUrlTemplate) return [];
    const parsed = parseChannelKey(channelKey);
    if (!parsed || parsed.platform !== 'kick') return []; // native Kick emotes only
    const url = template.replace('{channel}', encodeURIComponent(parsed.id));
    const payload = await this.net.fetchJson<unknown>(url);
    return this.collectEmotes(payload, /* channelOnly */ true);
  }

  /** Flatten any of the tolerated payload shapes into mapped emotes. */
  private collectEmotes(payload: unknown, channelOnly: boolean): Emote[] {
    // Shape 3: object wrapper { emotes: [...] }
    if (isRecord(payload)) return this.mapEntries(payload['emotes']);
    if (!Array.isArray(payload)) return [];

    const groups = payload.filter(
      (item): item is Record<string, unknown> => isRecord(item) && Array.isArray(item['emotes']),
    );
    // Shape 2: bare array of emote objects (no nested `emotes` arrays).
    if (groups.length === 0) return this.mapEntries(payload);

    // Shape 1: grouped. Channel groups carry a numeric id + slug; the shared
    // groups use the string ids "Global"/"Emoji".
    const isSharedGroup = (g: Record<string, unknown>): boolean =>
      typeof g['id'] === 'string' && NON_CHANNEL_GROUP_IDS.has(g['id']);
    let selected = groups;
    if (channelOnly) {
      selected = groups.filter((g) => !isSharedGroup(g));
    } else if (groups.some(isSharedGroup)) {
      // Global fetch on a grouped payload: only the shared groups (fall back
      // to all groups when the payload has no recognizable shared group).
      selected = groups.filter(isSharedGroup);
    }
    const out: Emote[] = [];
    for (const group of selected) out.push(...this.mapEntries(group['emotes']));
    return out;
  }

  private mapEntries(entries: unknown): Emote[] {
    return mapDefensively(entries, (entry) => this.mapEmote(entry));
  }

  private mapEmote(entry: unknown): Emote | null {
    if (!isRecord(entry)) return null;
    const id = asIdString(entry['id']);
    const code = asString(entry['name']);
    const template = this.config.emoteCdnUrlTemplate;
    if (!id || !code || !template) return null;

    const withId = template.replace('{id}', encodeURIComponent(id));
    const urls: Record<string, string> = {};
    if (withId.includes('{size}')) {
      for (const size of CDN_SIZES) urls[size] = withId.replace('{size}', size);
    } else {
      urls['1x'] = withId;
    }

    return {
      id,
      code,
      provider: this.id,
      urls,
      // Kick's payload exposes no animation/overlay metadata; render as
      // static, normal-width. The <img> still animates if the CDN file does.
      animated: false,
      zeroWidth: false,
    };
  }
}
