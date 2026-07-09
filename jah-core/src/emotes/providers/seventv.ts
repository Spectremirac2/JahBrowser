import type { NetworkBridge } from '../../engine/types.js';
import type { Emote, EmoteProvider } from '../types.js';
import { asString, httpsUrl, isRecord, mapDefensively, parseChannelKey } from './helpers.js';

/**
 * 7TV emote provider — v3 REST API (https://7tv.io/v3, docs: https://7tv.io/docs).
 *
 * Endpoints (verified against the live API, 2026-07):
 *   GET https://7tv.io/v3/emote-sets/global          -> EmoteSet { emotes: ActiveEmote[] }
 *   GET https://7tv.io/v3/users/{platform}/{id}      -> UserConnection { emote_set: EmoteSet | null }
 *     platform: "twitch" | "kick" | "youtube" — 7TV supports BOTH twitch and
 *     kick connections; the id is the platform-native numeric user id
 *     (for kick this is the numeric Kick user id, not the slug).
 *
 * ActiveEmote shape (sample from /v3/emote-sets/global, emote "RainTime"):
 *   { id, name, flags: 1, data: { animated: true, flags: 256,
 *     host: { url: "//cdn.7tv.app/emote/<id>", files: [{ name: "1x.webp",
 *       width, height, frame_count, size, format: "WEBP" }, ...] } } }
 *
 * Flag semantics (SevenTV common model, verified on live zero-width emotes):
 *   ActiveEmote.flags bit 0 (1)   = zero-width override on the set entry
 *   EmoteData.flags   bit 8 (256) = emote itself is zero-width
 */

const ACTIVE_EMOTE_FLAG_ZERO_WIDTH = 1 << 0;
const EMOTE_DATA_FLAG_ZERO_WIDTH = 1 << 8;

/** Matches CDN file names we expose as url sizes: 1x.webp .. 4x.webp. */
const WEBP_SIZE_FILE = /^([1-4]x)\.webp$/;

export class SevenTvEmoteProvider implements EmoteProvider {
  readonly id = '7tv' as const;

  constructor(
    private readonly net: NetworkBridge,
    private readonly apiBase = 'https://7tv.io/v3',
  ) {}

  async fetchGlobalEmotes(): Promise<Emote[]> {
    const set = await this.net.fetchJson<unknown>(`${this.apiBase}/emote-sets/global`);
    return this.mapEmoteSet(set);
  }

  async fetchChannelEmotes(channelKey: string): Promise<Emote[]> {
    const parsed = parseChannelKey(channelKey);
    if (!parsed) return []; // unsupported/malformed key — not an error
    const connection = await this.net.fetchJson<unknown>(
      `${this.apiBase}/users/${parsed.platform}/${encodeURIComponent(parsed.id)}`,
    );
    if (!isRecord(connection)) return [];
    // emote_set is null when the user has no active set on this connection.
    return this.mapEmoteSet(connection['emote_set']);
  }

  private mapEmoteSet(set: unknown): Emote[] {
    if (!isRecord(set)) return [];
    return mapDefensively(set['emotes'], (entry) => this.mapActiveEmote(entry));
  }

  private mapActiveEmote(entry: unknown): Emote | null {
    if (!isRecord(entry)) return null;
    const id = asString(entry['id']);
    const code = asString(entry['name']);
    const data = entry['data'];
    if (!id || !code || !isRecord(data)) return null;

    const host = data['host'];
    if (!isRecord(host)) return null;
    const hostUrl = asString(host['url']);
    if (!hostUrl) return null;

    const urls: Record<string, string> = {};
    if (Array.isArray(host['files'])) {
      for (const file of host['files']) {
        if (!isRecord(file)) continue;
        const name = asString(file['name']);
        const sizeMatch = name ? WEBP_SIZE_FILE.exec(name) : null;
        if (sizeMatch) urls[sizeMatch[1]] = `${httpsUrl(hostUrl)}/${name}`;
      }
    }
    if (Object.keys(urls).length === 0) return null;

    const activeFlags = typeof entry['flags'] === 'number' ? entry['flags'] : 0;
    const dataFlags = typeof data['flags'] === 'number' ? data['flags'] : 0;

    return {
      id,
      code,
      provider: this.id,
      urls,
      animated: data['animated'] === true,
      zeroWidth:
        (activeFlags & ACTIVE_EMOTE_FLAG_ZERO_WIDTH) !== 0 ||
        (dataFlags & EMOTE_DATA_FLAG_ZERO_WIDTH) !== 0,
    };
  }
}
