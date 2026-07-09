import type { NetworkBridge } from '../../engine/types.js';
import type { TokenProvider } from '../types.js';
import type { KickApiEnvelope, KickChannel, KickLivestream } from './types.js';

const KICK_API_BASE = 'https://api.kick.com/public/v1';

/** Documented request limits (docs.kick.com/apis/channels, /apis/livestreams). */
const MAX_SLUGS_PER_REQUEST = 50;
const MAX_IDS_PER_REQUEST = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Client for the OFFICIAL Kick public API (dev.kick.com, OAuth 2.1).
 * Product rule: official API first; the unofficial Pusher endpoints are
 * fallback-only and live in chat.ts behind a documented flag.
 */
export class KickClient {
  constructor(
    private readonly net: NetworkBridge,
    private readonly auth: TokenProvider,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const token = await this.auth.getAccessToken();
    const envelope = await this.net.fetchJson<KickApiEnvelope<T>>(`${KICK_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return envelope.data;
  }

  /**
   * GET /channels?slug=... — includes live status via `stream.is_live`.
   * Chunks transparently at the documented 50-slug limit.
   */
  async getChannels(slugs: string[]): Promise<KickChannel[]> {
    const batches = await Promise.all(
      chunk(slugs, MAX_SLUGS_PER_REQUEST).map((batch) => {
        const qs = batch.map((s) => `slug=${encodeURIComponent(s)}`).join('&');
        return this.get<KickChannel[]>(`/channels?${qs}`);
      }),
    );
    return batches.flat();
  }

  /**
   * GET /livestreams?broadcaster_user_id=...
   * @deprecated v1 livestreams is flagged deprecated in docs.kick.com and v2
   * removed the broadcaster_user_id filter. Use getChannels().stream.is_live
   * for live-status detection. Kept only for category browsing experiments.
   */
  async getLivestreams(broadcasterUserIds: number[]): Promise<KickLivestream[]> {
    const batches = await Promise.all(
      chunk(broadcasterUserIds, MAX_IDS_PER_REQUEST).map((batch) => {
        const qs = batch.map((id) => `broadcaster_user_id=${id}`).join('&');
        return this.get<KickLivestream[]>(`/livestreams?${qs}&limit=100`);
      }),
    );
    return batches.flat();
  }
}
