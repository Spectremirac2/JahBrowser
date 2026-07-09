/** Shared platform-layer types (Kick + Twitch). */

export type Platform = 'kick' | 'twitch';

/** Supplies OAuth access tokens; storage/refresh handled by the auth service. */
export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

export interface ChannelRef {
  platform: Platform;
  /** kick slug (e.g. "jahrein") or twitch login. */
  login: string;
  displayName: string;
}

export interface LiveStatus {
  channel: ChannelRef;
  live: boolean;
  title?: string;
  category?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
}
