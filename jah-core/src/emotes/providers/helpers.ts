/**
 * Shared helpers for emote providers.
 *
 * channelKey convention (used by EmoteEngine.loadChannel and every provider):
 *   "twitch:<user_id>"     — numeric Twitch user id (Helix `broadcaster_id`)
 *   "kick:<slug_or_id>"    — Kick channel slug or numeric id; which one a
 *                            provider needs is documented per provider
 *                            (e.g. 7TV expects the numeric Kick user id).
 *
 * Providers parse the key themselves and MUST return [] for platforms they do
 * not support instead of throwing — only real network failures are allowed to
 * propagate (EmoteEngine already .catch()es those per provider).
 */

export type ChannelPlatform = 'twitch' | 'kick';

export interface ParsedChannelKey {
  platform: ChannelPlatform;
  /** The part after the colon, verbatim (slug or id). */
  id: string;
}

/** Parse a channelKey; null for malformed keys or unknown platforms. */
export function parseChannelKey(channelKey: string): ParsedChannelKey | null {
  const sep = channelKey.indexOf(':');
  if (sep <= 0) return null;
  const platform = channelKey.slice(0, sep);
  const id = channelKey.slice(sep + 1);
  if (!id) return null;
  if (platform !== 'twitch' && platform !== 'kick') return null;
  return { platform, id };
}

/** Narrow an unknown value to a plain object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Return the value if it is a non-empty string, otherwise undefined. */
export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Accept string or number ids (FFZ/Kick use numbers) as a string. */
export function asIdString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Normalize protocol-relative CDN urls ("//cdn.7tv.app/...") to https. */
export function httpsUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

/**
 * Map every entry of a (possibly malformed) array with `map`, silently
 * skipping entries that map to null or throw — a single broken emote must
 * never take the whole provider down.
 */
export function mapDefensively<T>(entries: unknown, map: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(entries)) return [];
  const out: T[] = [];
  for (const entry of entries) {
    try {
      const mapped = map(entry);
      if (mapped !== null) out.push(mapped);
    } catch {
      // skip malformed entry
    }
  }
  return out;
}
