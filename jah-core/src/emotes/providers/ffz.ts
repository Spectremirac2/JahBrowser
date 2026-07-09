import type { NetworkBridge } from '../../engine/types.js';
import type { Emote, EmoteProvider } from '../types.js';
import { asIdString, asString, httpsUrl, isRecord, mapDefensively, parseChannelKey } from './helpers.js';

/**
 * FrankerFaceZ emote provider — v1 REST API (docs: https://api.frankerfacez.com/docs/).
 *
 * Endpoints (verified against the live API, 2026-07):
 *   GET https://api.frankerfacez.com/v1/set/global
 *     -> { default_sets: [3, ...], sets: { "<setId>": { emoticons: [...] } }, users: {...} }
 *   GET https://api.frankerfacez.com/v1/room/id/{twitchUserId}
 *     -> { room: { set: <setId>, ... }, sets: { "<setId>": { emoticons: [...] } } }
 *
 * Emoticon sample (from /v1/set/global):
 *   { id: 6, name: "YooHoo", height, width, modifier: false, modifier_flags: 0,
 *     urls: { "1": "https://cdn.frankerfacez.com/emote/6/1", "2": ..., "4": ... } }
 *
 * FFZ historically has NO animated flag; modern animated emotes carry an
 * `animated` field shaped like `urls` (size -> url of the animated variant).
 * We handle object (preferred urls) and boolean forms defensively.
 *
 * Zero-width: FFZ "modifier" emotes with modifier_flags bit 0 (1 = hidden)
 * are rendered as invisible overlay modifiers by FFZ clients — the closest
 * FFZ equivalent of a zero-width emote (e.g. emote 720507: modifier: true,
 * modifier_flags: 12289).
 */

const FFZ_MODIFIER_FLAG_HIDDEN = 1 << 0;

/** FFZ url keys -> our size keys. */
const FFZ_SIZES: ReadonlyArray<readonly [string, string]> = [
  ['1', '1x'],
  ['2', '2x'],
  ['4', '4x'],
];

export class FfzEmoteProvider implements EmoteProvider {
  readonly id = 'ffz' as const;

  constructor(
    private readonly net: NetworkBridge,
    private readonly apiBase = 'https://api.frankerfacez.com/v1',
  ) {}

  async fetchGlobalEmotes(): Promise<Emote[]> {
    const payload = await this.net.fetchJson<unknown>(`${this.apiBase}/set/global`);
    if (!isRecord(payload)) return [];
    // Only the sets FFZ marks as default are global for everyone; `sets` can
    // contain extra bonus sets that are user-specific.
    const defaultSets = Array.isArray(payload['default_sets']) ? payload['default_sets'] : [];
    const sets = isRecord(payload['sets']) ? payload['sets'] : {};
    const out: Emote[] = [];
    for (const setId of defaultSets) {
      const key = asIdString(setId);
      if (key) out.push(...this.mapSet(sets[key]));
    }
    return out;
  }

  async fetchChannelEmotes(channelKey: string): Promise<Emote[]> {
    const parsed = parseChannelKey(channelKey);
    if (!parsed || parsed.platform !== 'twitch') return []; // FFZ: twitch rooms only
    const payload = await this.net.fetchJson<unknown>(
      `${this.apiBase}/room/id/${encodeURIComponent(parsed.id)}`,
    );
    if (!isRecord(payload)) return [];
    const sets = isRecord(payload['sets']) ? payload['sets'] : {};
    const out: Emote[] = [];
    for (const set of Object.values(sets)) out.push(...this.mapSet(set));
    return out;
  }

  private mapSet(set: unknown): Emote[] {
    if (!isRecord(set)) return [];
    return mapDefensively(set['emoticons'], (entry) => this.mapEmoticon(entry));
  }

  private mapEmoticon(entry: unknown): Emote | null {
    if (!isRecord(entry)) return null;
    const id = asIdString(entry['id']);
    const code = asString(entry['name']);
    if (!id || !code) return null;

    const staticUrls = this.mapUrls(entry['urls']);
    // Animated variant urls win when present (same shape as `urls`).
    const animatedUrls = this.mapUrls(entry['animated']);
    const animated = Object.keys(animatedUrls).length > 0 || entry['animated'] === true;
    const urls = Object.keys(animatedUrls).length > 0 ? animatedUrls : staticUrls;
    if (Object.keys(urls).length === 0) return null;

    const modifierFlags = typeof entry['modifier_flags'] === 'number' ? entry['modifier_flags'] : 0;

    return {
      id,
      code,
      provider: this.id,
      urls,
      animated,
      zeroWidth: entry['modifier'] === true && (modifierFlags & FFZ_MODIFIER_FLAG_HIDDEN) !== 0,
    };
  }

  private mapUrls(raw: unknown): Record<string, string> {
    const urls: Record<string, string> = {};
    if (!isRecord(raw)) return urls;
    for (const [ffzKey, sizeKey] of FFZ_SIZES) {
      const url = asString(raw[ffzKey]);
      // Older FFZ payloads used protocol-relative urls — normalize to https.
      if (url) urls[sizeKey] = httpsUrl(url);
    }
    return urls;
  }
}
