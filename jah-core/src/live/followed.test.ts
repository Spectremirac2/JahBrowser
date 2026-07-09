import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import { FollowedChannelsService, type KickLiveApi, type TwitchLiveApi } from './followed.js';
import type { KickChannel } from '../platform/kick/types.js';
import type { LiveStatus } from '../platform/types.js';

function jahreinChannel(live: boolean): KickChannel {
  return {
    broadcaster_user_id: 42,
    slug: 'jahrein',
    channel_description: '',
    banner_picture: '',
    stream_title: 'Gündem + Dota',
    category: { id: 1, name: 'Just Chatting' },
    stream: live
      ? { is_live: true, viewer_count: 12000, start_time: '2026-07-04T19:00:00Z', thumbnail: 'https://kick/thumb.jpg' }
      : { is_live: false, viewer_count: 0, start_time: '' },
  };
}

const noTwitch: TwitchLiveApi = { getStreams: async () => [] };

describe('FollowedChannelsService', () => {
  it('fires go-live notification exactly once per transition (case-insensitive slugs)', async () => {
    const engine = new MockEngineAdapter();
    let live = false;
    const kick: KickLiveApi = { getChannels: async () => [jahreinChannel(live)] };
    const svc = new FollowedChannelsService(engine, kick, noTwitch);
    // 'Jahrein' with capital J — API returns slug 'jahrein'; match must survive
    await svc.setFollowed([{ platform: 'kick', login: 'Jahrein', displayName: 'Jahrein' }]);

    const events: LiveStatus[] = [];
    svc.onStatusChange((s) => events.push(s));

    await svc.pollNow(); // offline -> offline: no event
    expect(events).toHaveLength(0);

    live = true;
    await svc.pollNow(); // offline -> live: event + notification
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ live: true, title: 'Gündem + Dota', viewerCount: 12000 });
    expect(engine.notifications.shown).toHaveLength(1);
    expect(engine.notifications.shown[0].title).toBe('Jahrein yayın açtı!');

    await svc.pollNow(); // live -> live: no duplicate
    expect(events).toHaveLength(1);

    live = false;
    await svc.pollNow(); // live -> offline: status event, no notification
    expect(events).toHaveLength(2);
    expect(engine.notifications.shown).toHaveLength(1);
  });

  it('coalesces overlapping pollNow calls (no double notification)', async () => {
    const engine = new MockEngineAdapter();
    let release: (chans: KickChannel[]) => void = () => {};
    const kick: KickLiveApi = {
      getChannels: () => new Promise((resolve) => (release = resolve)),
    };
    const svc = new FollowedChannelsService(engine, kick, noTwitch);
    await svc.setFollowed([{ platform: 'kick', login: 'jahrein', displayName: 'Jahrein' }]);

    const p1 = svc.pollNow();
    const p2 = svc.pollNow(); // must be coalesced while p1 is in flight
    release([jahreinChannel(true)]);
    await Promise.all([p1, p2]);

    expect(engine.notifications.shown).toHaveLength(1);
  });

  it('isolates platform failures and reports them via onPollError', async () => {
    const engine = new MockEngineAdapter();
    const kick: KickLiveApi = {
      getChannels: async () => {
        throw new Error('kick 403');
      },
    };
    const twitch: TwitchLiveApi = {
      getStreams: async () => [
        {
          user_id: '1',
          user_login: 'elraenn',
          user_name: 'Elraenn',
          game_name: 'GTA V',
          title: 'RP',
          viewer_count: 30000,
          started_at: '2026-07-04T18:00:00Z',
          thumbnail_url: 'https://cdn/live_user_elraenn-{width}x{height}.jpg',
        },
      ],
    };
    const svc = new FollowedChannelsService(engine, kick, twitch);
    await svc.setFollowed([
      { platform: 'kick', login: 'jahrein', displayName: 'Jahrein' },
      { platform: 'twitch', login: 'Elraenn', displayName: 'Elraenn' },
    ]);
    const errors: unknown[] = [];
    svc.onPollError((e) => errors.push(e));
    const events: LiveStatus[] = [];
    svc.onStatusChange((s) => events.push(s));

    await svc.pollNow();

    expect(errors).toHaveLength(1); // kick failure reported, not swallowed
    expect(events).toHaveLength(1); // twitch side still worked
    // thumbnail template placeholders must be resolved
    expect(events[0].thumbnailUrl).toBe('https://cdn/live_user_elraenn-440x248.jpg');
  });

  it('persists and reloads the followed list', async () => {
    const engine = new MockEngineAdapter();
    const kick: KickLiveApi = { getChannels: async () => [] };
    const svc1 = new FollowedChannelsService(engine, kick, noTwitch);
    await svc1.setFollowed([{ platform: 'kick', login: 'jahrein', displayName: 'Jahrein' }]);

    const svc2 = new FollowedChannelsService(engine, kick, noTwitch);
    await svc2.load(); // fresh instance, same storage: survives restart
    expect(svc2.getFollowed()).toEqual([{ platform: 'kick', login: 'jahrein', displayName: 'Jahrein' }]);
  });
});
