import { describe, expect, it } from 'vitest';
import { EmoteEngine } from './engine.js';
import type { Emote, EmoteProvider } from './types.js';

function fakeEmote(code: string): Emote {
  return { id: code, code, provider: '7tv', urls: { '1x': `https://cdn/${code}` }, animated: false, zeroWidth: false };
}

function fakeProvider(global: string[], channel: string[]): EmoteProvider {
  return {
    id: '7tv',
    fetchGlobalEmotes: async () => global.map(fakeEmote),
    fetchChannelEmotes: async () => channel.map(fakeEmote),
  };
}

describe('EmoteEngine', () => {
  it('resolves channel emotes over global emotes and segments messages', async () => {
    const engine = new EmoteEngine();
    engine.registerProvider(fakeProvider(['KEKW'], ['jahPog']));
    await engine.loadGlobal();
    await engine.loadChannel('kick:jahrein');

    expect(engine.resolve('kick:jahrein', 'KEKW')?.code).toBe('KEKW');
    expect(engine.resolve('kick:jahrein', 'jahPog')?.code).toBe('jahPog');
    expect(engine.resolve('kick:jahrein', 'yok')).toBeUndefined();

    const segments = engine.segment('kick:jahrein', 'selam KEKW nasılsınız jahPog');
    expect(segments).toEqual([
      { kind: 'text', text: 'selam ' },
      { kind: 'emote', emote: expect.objectContaining({ code: 'KEKW' }) },
      { kind: 'text', text: 'nasılsınız ' },
      { kind: 'emote', emote: expect.objectContaining({ code: 'jahPog' }) },
    ]);
  });

  it('survives a failing provider', async () => {
    const engine = new EmoteEngine();
    engine.registerProvider({
      id: 'bttv',
      fetchGlobalEmotes: async () => {
        throw new Error('network down');
      },
      fetchChannelEmotes: async () => {
        throw new Error('network down');
      },
    });
    await engine.loadGlobal();
    await engine.loadChannel('kick:jahrein');
    expect(engine.segment('kick:jahrein', 'sade metin')).toEqual([{ kind: 'text', text: 'sade metin' }]);
  });
});
