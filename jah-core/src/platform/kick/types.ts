/** Kick official public API (docs.kick.com) response shapes — minimal v0 subset. */

/** Live-stream info embedded in the channels response (docs.kick.com/apis/channels). */
export interface KickChannelStream {
  is_live: boolean;
  viewer_count: number;
  start_time: string;
  thumbnail?: string;
  url?: string;
  language?: string;
  is_mature?: boolean;
}

export interface KickChannel {
  broadcaster_user_id: number;
  slug: string;
  channel_description: string;
  banner_picture: string;
  stream_title: string;
  stream?: KickChannelStream;
  category?: { id: number; name: string; thumbnail?: string };
}

/**
 * v1 livestreams response shape. NOTE: /public/v1/livestreams is marked
 * DEPRECATED in the docs and v2 dropped the broadcaster_user_id filter —
 * live-status detection must use /channels (KickChannelStream.is_live).
 */
export interface KickLivestream {
  broadcaster_user_id: number;
  channel_id: number;
  slug: string;
  stream_title: string;
  started_at: string;
  viewer_count: number;
  thumbnail?: string;
  category?: { id: number; name: string };
}

export interface KickApiEnvelope<T> {
  data: T;
  message: string;
}

export interface KickChatMessage {
  id: string;
  chatroomId: number;
  senderUsername: string;
  senderColor?: string;
  content: string;
  createdAt: string;
  /** Sender badge slugs (moderator, og, vip, subscriber...). */
  badges: string[];
}
