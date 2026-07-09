import type { NetworkBridge } from '../../engine/types.js';
import type { TokenProvider } from '../types.js';

const HELIX_BASE = 'https://api.twitch.tv/helix';

/** Documented limits (dev.twitch.tv/docs/api/reference/#get-streams). */
const MAX_LOGINS_PER_REQUEST = 100;
const PAGE_SIZE = 100; // 'first' defaults to 20 — too small, silently drops live channels

export interface TwitchStream {
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
}

interface HelixEnvelope<T> {
  data: T[];
  pagination?: { cursor?: string };
}

/** Twitch Helix client — v0 subset (live status for the unified sidebar). */
export class TwitchClient {
  constructor(
    private readonly net: NetworkBridge,
    private readonly auth: TokenProvider,
    private readonly clientId: string,
  ) {}

  /** GET /streams?user_login=... — returns only currently-live channels. */
  async getStreams(userLogins: string[]): Promise<TwitchStream[]> {
    const token = await this.auth.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Client-Id': this.clientId,
    };

    const out: TwitchStream[] = [];
    for (let i = 0; i < userLogins.length; i += MAX_LOGINS_PER_REQUEST) {
      const batch = userLogins.slice(i, i + MAX_LOGINS_PER_REQUEST);
      const baseQs = batch.map((l) => `user_login=${encodeURIComponent(l)}`).join('&');
      let cursor: string | undefined;
      do {
        const pageQs = `${baseQs}&first=${PAGE_SIZE}${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`;
        const res = await this.net.fetchJson<HelixEnvelope<TwitchStream>>(
          `${HELIX_BASE}/streams?${pageQs}`,
          { headers },
        );
        out.push(...res.data);
        cursor = res.pagination?.cursor;
      } while (cursor);
    }
    return out;
  }

  // TODO(faz-1): EventSub websocket subscription (stream.online/offline) so
  // go-live notifications are push-based instead of polled.
}

/**
 * Helix returns thumbnail_url as a TEMPLATE ("...-{width}x{height}.jpg");
 * placeholders MUST be substituted before the URL is usable.
 */
export function resolveTwitchThumbnail(templateUrl: string, width = 440, height = 248): string {
  return templateUrl.replace('{width}', String(width)).replace('{height}', String(height));
}
