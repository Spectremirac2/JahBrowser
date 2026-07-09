import type { EngineAdapter, Unsubscribe } from '../engine/types.js';
import type { ChannelRef, LiveStatus } from '../platform/types.js';
import type { KickChannel } from '../platform/kick/types.js';
import { resolveTwitchThumbnail, type TwitchStream } from '../platform/twitch/client.js';

/** Structural interfaces so tests/fakes don't need the concrete clients. */
export interface KickLiveApi {
  /** Channels response carries live status (stream.is_live) — the non-deprecated path. */
  getChannels(slugs: string[]): Promise<KickChannel[]>;
}

export interface TwitchLiveApi {
  getStreams(userLogins: string[]): Promise<TwitchStream[]>;
}

const STORAGE_KEY = 'followed-channels';

/**
 * Unified Kick+Twitch live-status service — data layer behind the two
 * flagship P0 features: the unified live sidebar and the reliable
 * "Jahrein yayın açtı" go-live notification.
 *
 * v0 polls; Faz 1 upgrades Twitch to EventSub push and Kick to webhooks
 * where available. Poll interval respects platform rate limits.
 */
export class FollowedChannelsService {
  private followed: ChannelRef[] = [];
  private lastLive = new Map<string, boolean>();
  private listeners = new Set<(status: LiveStatus) => void>();
  private errorListeners = new Set<(err: unknown) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    private readonly engine: EngineAdapter,
    private readonly kick: KickLiveApi,
    private readonly twitch: TwitchLiveApi,
    private readonly pollIntervalMs = 60_000,
  ) {}

  /** Hydrate the followed list persisted by a previous session. Call before start(). */
  async load(): Promise<void> {
    const saved = await this.engine.storage.get<ChannelRef[]>(STORAGE_KEY);
    if (saved) this.followed = saved;
  }

  /** Pure setter — no I/O beyond persistence, so it cannot half-fail. */
  async setFollowed(channels: ChannelRef[]): Promise<void> {
    this.followed = channels;
    await this.engine.storage.set(STORAGE_KEY, channels);
  }

  getFollowed(): ChannelRef[] {
    return [...this.followed];
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.pollNow(), this.pollIntervalMs);
    void this.pollNow();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  onStatusChange(cb: (status: LiveStatus) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Poll failures are reported here instead of being silently swallowed. */
  onPollError(cb: (err: unknown) => void): Unsubscribe {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  /**
   * Single poll cycle; public so tests and manual refresh can drive it.
   * Overlapping calls are coalesced — otherwise a slow API response plus the
   * interval timer would double-fire the same go-live transition.
   */
  async pollNow(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const statuses = await this.fetchAll();
      for (const status of statuses) {
        const key = `${status.channel.platform}:${status.channel.login.toLowerCase()}`;
        const wasLive = this.lastLive.get(key) ?? false;
        this.lastLive.set(key, status.live);
        if (status.live !== wasLive) {
          for (const cb of this.listeners) cb(status);
          if (status.live) {
            await this.engine.notifications.show({
              title: `${status.channel.displayName} yayın açtı!`,
              body: status.title ?? '',
              onClickUrl: this.channelUrl(status.channel),
            });
          }
        }
      }
    } finally {
      this.polling = false;
    }
  }

  /** Per-platform isolation: a Kick 403 must not blind the Twitch side (or vice versa). */
  private async fetchAll(): Promise<LiveStatus[]> {
    const kickRefs = this.followed.filter((c) => c.platform === 'kick');
    const twitchRefs = this.followed.filter((c) => c.platform === 'twitch');
    const out: LiveStatus[] = [];

    if (kickRefs.length) {
      try {
        const channels = await this.kick.getChannels(kickRefs.map((c) => c.login.toLowerCase()));
        for (const ref of kickRefs) {
          const ch = channels.find((c) => c.slug.toLowerCase() === ref.login.toLowerCase());
          const stream = ch?.stream;
          out.push({
            channel: ref,
            live: stream?.is_live ?? false,
            title: ch?.stream_title,
            category: ch?.category?.name,
            viewerCount: stream?.viewer_count,
            startedAt: stream?.start_time,
            thumbnailUrl: stream?.thumbnail,
          });
        }
      } catch (err) {
        this.emitError(err);
      }
    }

    if (twitchRefs.length) {
      try {
        const live = await this.twitch.getStreams(twitchRefs.map((c) => c.login));
        for (const ref of twitchRefs) {
          const stream = live.find((s) => s.user_login.toLowerCase() === ref.login.toLowerCase());
          out.push({
            channel: ref,
            live: Boolean(stream),
            title: stream?.title,
            category: stream?.game_name,
            viewerCount: stream?.viewer_count,
            startedAt: stream?.started_at,
            thumbnailUrl: stream ? resolveTwitchThumbnail(stream.thumbnail_url) : undefined,
          });
        }
      } catch (err) {
        this.emitError(err);
      }
    }

    return out;
  }

  private emitError(err: unknown): void {
    for (const cb of this.errorListeners) cb(err);
  }

  private channelUrl(ref: ChannelRef): string {
    return ref.platform === 'kick' ? `https://kick.com/${ref.login}` : `https://twitch.tv/${ref.login}`;
  }
}
