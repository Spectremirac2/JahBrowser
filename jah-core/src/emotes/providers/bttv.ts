import type { NetworkBridge } from '../../engine/types.js';
import type { Emote, EmoteProvider } from '../types.js';
import { asString, isRecord, mapDefensively, parseChannelKey } from './helpers.js';

/**
 * BetterTTV emote provider — cached REST API (docs: https://betterttv.com/developers).
 *
 * Endpoints (verified against the live API, 2026-07):
 *   GET https://api.betterttv.net/3/cached/emotes/global
 *     -> [{ id, code, imageType: "png"|"gif"|"webp", animated: bool, userId, modifier }]
 *   GET https://api.betterttv.net/3/cached/users/twitch/{providerId}
 *     -> { id, bots, avatar, channelEmotes: [...], sharedEmotes: [...] }
 *     channelEmotes entry sample: { id, code, imageType: "gif", animated: true, userId }
 *     sharedEmotes entry sample:  { id, code, imageType, animated, user: { id, name, ... } }
 *
 * CDN url construction: https://cdn.betterttv.net/emote/{id}/{1x|2x|3x}
 * BTTV serves twitch users only — "kick:*" channel keys resolve to [].
 *
 * Zero-width: BTTV has no API flag; clients (Chatterino, the BTTV extension
 * itself) hardcode the known overlay emote codes. Same approach here.
 */

const BTTV_ZERO_WIDTH_CODES: ReadonlySet<string> = new Set([
  'SoSnowy',
  'IceCold',
  'SantaHat',
  'TopHat',
  'ReinDeer',
  'CandyCane',
  'cvMask',
  'cvHazmat',
]);

export class BttvEmoteProvider implements EmoteProvider {
  readonly id = 'bttv' as const;

  constructor(
    private readonly net: NetworkBridge,
    private readonly apiBase = 'https://api.betterttv.net/3',
    private readonly cdnBase = 'https://cdn.betterttv.net/emote',
  ) {}

  async fetchGlobalEmotes(): Promise<Emote[]> {
    const entries = await this.net.fetchJson<unknown>(`${this.apiBase}/cached/emotes/global`);
    return mapDefensively(entries, (entry) => this.mapEmote(entry));
  }

  async fetchChannelEmotes(channelKey: string): Promise<Emote[]> {
    const parsed = parseChannelKey(channelKey);
    if (!parsed || parsed.platform !== 'twitch') return []; // BTTV: twitch only
    const user = await this.net.fetchJson<unknown>(
      `${this.apiBase}/cached/users/twitch/${encodeURIComponent(parsed.id)}`,
    );
    if (!isRecord(user)) return [];
    return [
      ...mapDefensively(user['channelEmotes'], (entry) => this.mapEmote(entry)),
      ...mapDefensively(user['sharedEmotes'], (entry) => this.mapEmote(entry)),
    ];
  }

  private mapEmote(entry: unknown): Emote | null {
    if (!isRecord(entry)) return null;
    const id = asString(entry['id']);
    const code = asString(entry['code']);
    if (!id || !code) return null;
    return {
      id,
      code,
      provider: this.id,
      urls: {
        '1x': `${this.cdnBase}/${id}/1x`,
        '2x': `${this.cdnBase}/${id}/2x`,
        '3x': `${this.cdnBase}/${id}/3x`,
      },
      // `animated` is authoritative when present; older cached entries only
      // carry imageType, where gif implies animation.
      animated: entry['animated'] === true || entry['imageType'] === 'gif',
      zeroWidth: BTTV_ZERO_WIDTH_CODES.has(code),
    };
  }
}
