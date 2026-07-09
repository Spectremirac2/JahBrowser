/** Native emote engine types — replaces 7TV/BTTV/FFZ/Kick browser extensions. */

export type EmoteProviderId = '7tv' | 'bttv' | 'ffz' | 'kick';

export interface Emote {
  id: string;
  /** Chat code, e.g. "KEKW". */
  code: string;
  provider: EmoteProviderId;
  /** url per size, e.g. { "1x": "...", "2x": "..." }. */
  urls: Record<string, string>;
  animated: boolean;
  zeroWidth: boolean;
}

export interface EmoteProvider {
  readonly id: EmoteProviderId;
  fetchGlobalEmotes(): Promise<Emote[]>;
  /** channelKey: platform-specific channel identifier. */
  fetchChannelEmotes(channelKey: string): Promise<Emote[]>;
}

/** A chat message split into renderable segments. */
export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'emote'; emote: Emote };
