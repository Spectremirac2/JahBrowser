import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../../engine/mock.js';
import { BttvEmoteProvider } from './bttv.js';
import { FfzEmoteProvider } from './ffz.js';
import { parseChannelKey } from './helpers.js';
import { KickEmoteProvider } from './kick.js';
import { SevenTvEmoteProvider } from './seventv.js';

/**
 * Fixtures are trimmed copies of REAL live responses (captured 2026-07):
 *  - 7TV:  GET https://7tv.io/v3/emote-sets/global (emote "RainTime"),
 *          GET https://7tv.io/v3/users/twitch/71092938 (emote "GAMBA")
 *  - BTTV: GET https://api.betterttv.net/3/cached/emotes/global,
 *          GET https://api.betterttv.net/3/cached/users/twitch/22484632
 *  - FFZ:  GET https://api.frankerfacez.com/v1/set/global (emote "YooHoo"),
 *          GET https://api.frankerfacez.com/v1/emote/720507 (hidden modifier)
 */

describe('parseChannelKey', () => {
  it('parses the documented channelKey convention', () => {
    expect(parseChannelKey('twitch:71092938')).toEqual({ platform: 'twitch', id: '71092938' });
    expect(parseChannelKey('kick:jahrein')).toEqual({ platform: 'kick', id: 'jahrein' });
  });

  it('rejects unknown platforms and malformed keys', () => {
    expect(parseChannelKey('youtube:abc')).toBeNull();
    expect(parseChannelKey('jahrein')).toBeNull();
    expect(parseChannelKey('twitch:')).toBeNull();
    expect(parseChannelKey(':123')).toBeNull();
  });
});

// --- 7TV -------------------------------------------------------------------

/** Real shape from https://7tv.io/v3/emote-sets/global ("RainTime"). */
const SEVENTV_RAINTIME = {
  id: '01FCY771D800007PQ2DF3GDTN6',
  name: 'RainTime',
  flags: 1, // ActiveEmote zero-width bit
  timestamp: 1628806809000,
  data: {
    id: '01FCY771D800007PQ2DF3GDTN6',
    name: 'RainTime',
    flags: 256, // EmoteData zero-width bit
    listed: true,
    animated: true,
    host: {
      url: '//cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6',
      files: [
        { name: '1x.avif', width: 32, height: 32, format: 'AVIF' },
        { name: '1x.webp', static_name: '1x_static.webp', width: 32, height: 32, frame_count: 15, size: 13620, format: 'WEBP' },
        { name: '2x.webp', width: 64, height: 64, format: 'WEBP' },
        { name: '3x.webp', width: 96, height: 96, format: 'WEBP' },
        { name: '4x.webp', width: 128, height: 128, format: 'WEBP' },
      ],
    },
  },
};

/** Real shape from https://7tv.io/v3/users/twitch/71092938 ("GAMBA"). */
const SEVENTV_GAMBA = {
  id: '01G3WEGZN0000ET2J0MQP5YJ0G',
  name: 'GAMBA',
  flags: 0,
  data: {
    animated: true,
    flags: 0,
    host: {
      url: '//cdn.7tv.app/emote/01G3WEGZN0000ET2J0MQP5YJ0G',
      files: [
        { name: '1x.webp', width: 39, height: 32, frame_count: 102, format: 'WEBP' },
        { name: '2x.webp', width: 78, height: 64, format: 'WEBP' },
      ],
    },
  },
};

describe('SevenTvEmoteProvider', () => {
  it('maps the global set: urls per size, animated + zero-width flags', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://7tv.io/v3/emote-sets/global', () => ({
      id: '01HKQT8EWR000ESSWF3625XCS4',
      name: 'Global Emotes',
      flags: 0,
      emotes: [SEVENTV_RAINTIME, { id: 'broken' } /* malformed: skipped */],
    }));
    const provider = new SevenTvEmoteProvider(engine.net);

    const emotes = await provider.fetchGlobalEmotes();
    expect(emotes).toHaveLength(1);
    expect(emotes[0]).toEqual({
      id: '01FCY771D800007PQ2DF3GDTN6',
      code: 'RainTime',
      provider: '7tv',
      urls: {
        '1x': 'https://cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6/1x.webp',
        '2x': 'https://cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6/2x.webp',
        '3x': 'https://cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6/3x.webp',
        '4x': 'https://cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6/4x.webp',
      },
      animated: true,
      zeroWidth: true,
    });
  });

  it('fetches twitch channel emotes via the user connection endpoint', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://7tv.io/v3/users/twitch/71092938', () => ({
      id: '71092938',
      platform: 'TWITCH',
      username: 'xqc',
      emote_set: { id: '01FE9DRF000009TR6M9N941CYW', name: "xQc's Emotes", flags: 0, emotes: [SEVENTV_GAMBA] },
    }));
    const provider = new SevenTvEmoteProvider(engine.net);

    const emotes = await provider.fetchChannelEmotes('twitch:71092938');
    expect(emotes).toHaveLength(1);
    expect(emotes[0].code).toBe('GAMBA');
    expect(emotes[0].animated).toBe(true);
    expect(emotes[0].zeroWidth).toBe(false);
    expect(emotes[0].urls['1x']).toBe('https://cdn.7tv.app/emote/01G3WEGZN0000ET2J0MQP5YJ0G/1x.webp');
  });

  it('supports kick connections too (7TV serves both platforms)', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://7tv.io/v3/users/kick/1234567', () => ({
      id: '1234567',
      platform: 'KICK',
      emote_set: { emotes: [SEVENTV_GAMBA] },
    }));
    const provider = new SevenTvEmoteProvider(engine.net);
    const emotes = await provider.fetchChannelEmotes('kick:1234567');
    expect(emotes.map((e) => e.code)).toEqual(['GAMBA']);
  });

  it('returns [] for unsupported/malformed channel keys and null emote_set', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://7tv.io/v3/users/twitch/999', () => ({ emote_set: null }));
    const provider = new SevenTvEmoteProvider(engine.net);
    expect(await provider.fetchChannelEmotes('youtube:abc')).toEqual([]);
    expect(await provider.fetchChannelEmotes('bozukanahtar')).toEqual([]);
    expect(await provider.fetchChannelEmotes('twitch:999')).toEqual([]);
  });

  it('surfaces network errors as rejections (EmoteEngine catches them)', async () => {
    const engine = new MockEngineAdapter(); // no responder registered
    const provider = new SevenTvEmoteProvider(engine.net);
    await expect(provider.fetchGlobalEmotes()).rejects.toThrow();
  });
});

// --- BTTV ------------------------------------------------------------------

describe('BttvEmoteProvider', () => {
  it('maps global emotes and constructs CDN urls', async () => {
    const engine = new MockEngineAdapter();
    // Real shape from https://api.betterttv.net/3/cached/emotes/global
    engine.net.respondWith('https://api.betterttv.net/3/cached/emotes/global', () => [
      { id: '54fa8f1401e468494b85b537', code: ':tf:', imageType: 'png', animated: false, userId: '5561169bd6b9d206222a8c19', modifier: false },
      { id: '5849c9a4f52be01a7ee5f79d', code: 'IceCold', imageType: 'png', animated: false, userId: '5561169bd6b9d206222a8c19', modifier: false },
      { code: 'idsiz' }, // malformed: skipped
    ]);
    const provider = new BttvEmoteProvider(engine.net);

    const emotes = await provider.fetchGlobalEmotes();
    expect(emotes).toHaveLength(2);
    expect(emotes[0]).toEqual({
      id: '54fa8f1401e468494b85b537',
      code: ':tf:',
      provider: 'bttv',
      urls: {
        '1x': 'https://cdn.betterttv.net/emote/54fa8f1401e468494b85b537/1x',
        '2x': 'https://cdn.betterttv.net/emote/54fa8f1401e468494b85b537/2x',
        '3x': 'https://cdn.betterttv.net/emote/54fa8f1401e468494b85b537/3x',
      },
      animated: false,
      zeroWidth: false,
    });
    // Known BTTV overlay emote code -> zero-width
    expect(emotes[1].zeroWidth).toBe(true);
  });

  it('merges channelEmotes and sharedEmotes for a twitch user', async () => {
    const engine = new MockEngineAdapter();
    // Real shape from https://api.betterttv.net/3/cached/users/twitch/22484632
    engine.net.respondWith('https://api.betterttv.net/3/cached/users/twitch/22484632', () => ({
      id: '5717c985b017b9d058fad265',
      bots: [],
      avatar: 'https://static-cdn.jtvnw.net/...',
      channelEmotes: [
        { id: '6027ea208fbb823604bde323', code: 'YESIDOTHINKSOr', imageType: 'gif', animated: true, userId: '555943515393e61c772ee968' },
      ],
      sharedEmotes: [
        {
          id: '69fbef951adf936b4295ad9a',
          code: 'BBLookingAtYou',
          imageType: 'png',
          animated: false,
          user: { id: '65d01bb7f867e4b149d47481', name: 'huansox', displayName: 'hUaNsOx', providerId: '1032428662' },
        },
      ],
    }));
    const provider = new BttvEmoteProvider(engine.net);

    const emotes = await provider.fetchChannelEmotes('twitch:22484632');
    expect(emotes.map((e) => e.code)).toEqual(['YESIDOTHINKSOr', 'BBLookingAtYou']);
    expect(emotes[0].animated).toBe(true);
    expect(emotes[1].animated).toBe(false);
  });

  it('falls back to imageType gif when the animated field is absent', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://api.betterttv.net/3/cached/emotes/global', () => [
      { id: 'abc', code: 'OldGif', imageType: 'gif' },
    ]);
    const provider = new BttvEmoteProvider(engine.net);
    expect((await provider.fetchGlobalEmotes())[0].animated).toBe(true);
  });

  it('returns [] for kick channels — BTTV serves twitch only', async () => {
    const engine = new MockEngineAdapter(); // any fetch would throw: proves no request happens
    const provider = new BttvEmoteProvider(engine.net);
    expect(await provider.fetchChannelEmotes('kick:jahrein')).toEqual([]);
  });
});

// --- FFZ -------------------------------------------------------------------

/** Real shape from https://api.frankerfacez.com/v1/set/global ("YooHoo"). */
const FFZ_YOOHOO = {
  id: 6,
  name: 'YooHoo',
  height: 34,
  width: 28,
  public: false,
  hidden: false,
  modifier: false,
  modifier_flags: 0,
  urls: {
    '1': 'https://cdn.frankerfacez.com/emote/6/1',
    '2': 'https://cdn.frankerfacez.com/emote/6/2',
    '4': 'https://cdn.frankerfacez.com/emote/6/4',
  },
};

describe('FfzEmoteProvider', () => {
  it('maps only default_sets from the global payload', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://api.frankerfacez.com/v1/set/global', () => ({
      default_sets: [3],
      sets: {
        '3': { id: 3, title: 'Global Emotes', emoticons: [FFZ_YOOHOO, { name: 'idsiz' }] },
        '4330': { id: 4330, title: 'Bonus set — not default', emoticons: [{ ...FFZ_YOOHOO, id: 99, name: 'BonusEmote' }] },
      },
      users: {},
    }));
    const provider = new FfzEmoteProvider(engine.net);

    const emotes = await provider.fetchGlobalEmotes();
    expect(emotes).toHaveLength(1);
    expect(emotes[0]).toEqual({
      id: '6',
      code: 'YooHoo',
      provider: 'ffz',
      urls: {
        '1x': 'https://cdn.frankerfacez.com/emote/6/1',
        '2x': 'https://cdn.frankerfacez.com/emote/6/2',
        '4x': 'https://cdn.frankerfacez.com/emote/6/4',
      },
      animated: false,
      zeroWidth: false,
    });
  });

  it('maps room emotes: hidden modifiers are zero-width, animated urls win', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://api.frankerfacez.com/v1/room/id/22484632', () => ({
      room: { _id: 55351, twitch_id: 22484632, set: 55351 },
      sets: {
        '55351': {
          id: 55351,
          emoticons: [
            // Real hidden-modifier shape (https://api.frankerfacez.com/v1/emote/720507)
            {
              id: 720507,
              name: 'ffzHat',
              modifier: true,
              modifier_flags: 12289, // bit 0 (hidden) set
              urls: { '1': 'https://cdn.frankerfacez.com/emote/720507/1', '2': 'https://cdn.frankerfacez.com/emote/720507/2', '4': 'https://cdn.frankerfacez.com/emote/720507/4' },
            },
            // Animated emote: `animated` mirrors `urls` with animated variants
            {
              id: 723102,
              name: 'DansGame',
              modifier: false,
              modifier_flags: 0,
              urls: { '1': 'https://cdn.frankerfacez.com/emote/723102/1' },
              animated: { '1': 'https://cdn.frankerfacez.com/emote/723102/animated/1', '2': 'https://cdn.frankerfacez.com/emote/723102/animated/2' },
            },
            // Legacy protocol-relative url form
            { id: 7, name: 'EskiEmote', urls: { '1': '//cdn.frankerfacez.com/emote/7/1' } },
          ],
        },
      },
    }));
    const provider = new FfzEmoteProvider(engine.net);

    const emotes = await provider.fetchChannelEmotes('twitch:22484632');
    expect(emotes.map((e) => e.code)).toEqual(['ffzHat', 'DansGame', 'EskiEmote']);

    expect(emotes[0].zeroWidth).toBe(true);
    expect(emotes[0].animated).toBe(false);

    expect(emotes[1].animated).toBe(true);
    expect(emotes[1].urls).toEqual({
      '1x': 'https://cdn.frankerfacez.com/emote/723102/animated/1',
      '2x': 'https://cdn.frankerfacez.com/emote/723102/animated/2',
    });

    expect(emotes[2].urls['1x']).toBe('https://cdn.frankerfacez.com/emote/7/1');
  });

  it('returns [] for kick channels — FFZ serves twitch rooms only', async () => {
    const engine = new MockEngineAdapter();
    const provider = new FfzEmoteProvider(engine.net);
    expect(await provider.fetchChannelEmotes('kick:jahrein')).toEqual([]);
  });
});

// --- Kick native -----------------------------------------------------------

const KICK_CONFIG = {
  channelEmotesUrlTemplate: 'https://kick-plus.example/emotes/{channel}',
  emoteCdnUrlTemplate: 'https://files.kick.com/emotes/{id}/fullsize',
  globalEmotesUrl: 'https://kick-plus.example/emotes/global',
};

/** Grouped shape community tools observed from Kick's site endpoint. */
function kickGroupedPayload(): unknown {
  return [
    {
      id: 1103211,
      user_id: 1132211,
      slug: 'jahrein',
      emotes: [
        { id: 39861, channel_id: 1103211, name: 'jahReyiz', subscribers_only: false },
        { id: 39862, channel_id: 1103211, name: 'jahSub', subscribers_only: true },
        { name: 'idsiz' }, // malformed: skipped
      ],
    },
    { id: 'Global', emotes: [{ id: 1730752, name: 'emojiEvolution', subscribers_only: false }] },
    { id: 'Emoji', emotes: [{ id: 1730762, name: 'wink', subscribers_only: false }] },
  ];
}

describe('KickEmoteProvider', () => {
  it('fetches channel emotes from the config-injected endpoint, skipping Global/Emoji groups', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://kick-plus.example/emotes/jahrein', kickGroupedPayload);
    const provider = new KickEmoteProvider(engine.net, KICK_CONFIG);

    const emotes = await provider.fetchChannelEmotes('kick:jahrein');
    expect(emotes.map((e) => e.code)).toEqual(['jahReyiz', 'jahSub']);
    expect(emotes[0]).toEqual({
      id: '39861',
      code: 'jahReyiz',
      provider: 'kick',
      urls: { '1x': 'https://files.kick.com/emotes/39861/fullsize' },
      animated: false,
      zeroWidth: false,
    });
  });

  it('takes only the shared groups for global emotes on a grouped payload', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://kick-plus.example/emotes/global', kickGroupedPayload);
    const provider = new KickEmoteProvider(engine.net, KICK_CONFIG);

    const emotes = await provider.fetchGlobalEmotes();
    expect(emotes.map((e) => e.code)).toEqual(['emojiEvolution', 'wink']);
  });

  it('expands a {size} placeholder in the CDN template', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://kick-plus.example/emotes/jahrein', () => [
      { id: 39861, name: 'jahReyiz' }, // bare-array shape
    ]);
    const provider = new KickEmoteProvider(engine.net, {
      ...KICK_CONFIG,
      emoteCdnUrlTemplate: 'https://files.kick.com/emotes/{id}/{size}',
    });

    const emotes = await provider.fetchChannelEmotes('kick:jahrein');
    expect(emotes[0].urls).toEqual({
      '1x': 'https://files.kick.com/emotes/39861/1x',
      '2x': 'https://files.kick.com/emotes/39861/2x',
      '3x': 'https://files.kick.com/emotes/39861/3x',
      '4x': 'https://files.kick.com/emotes/39861/4x',
    });
  });

  it('parses defensively: unexpected shapes become [], never a crash', async () => {
    const engine = new MockEngineAdapter();
    engine.net.respondWith('https://kick-plus.example/emotes/jahrein', () => ({ hata: 'beklenmedik' }));
    const provider = new KickEmoteProvider(engine.net, KICK_CONFIG);
    expect(await provider.fetchChannelEmotes('kick:jahrein')).toEqual([]);
  });

  it('is disabled without remote config and ignores non-kick channels', async () => {
    const engine = new MockEngineAdapter(); // any fetch would throw
    const unconfigured = new KickEmoteProvider(engine.net, {});
    expect(await unconfigured.fetchGlobalEmotes()).toEqual([]);
    expect(await unconfigured.fetchChannelEmotes('kick:jahrein')).toEqual([]);

    const configured = new KickEmoteProvider(engine.net, KICK_CONFIG);
    expect(await configured.fetchChannelEmotes('twitch:22484632')).toEqual([]);
  });
});
