import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import { SesMasasiService, type SesMasasiState } from './sesmasasi.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Creates a tab and flips its audible flag directly on the mock's TabInfo. */
async function makeTab(engine: MockEngineAdapter, url: string, audible = true) {
  const tab = await engine.tabs.create({ url });
  for (const t of await engine.tabs.list()) {
    if (t.id === tab.id) t.audible = audible;
  }
  return tab;
}

/** Monkey-patch spy on setAudioLevel (broadcast.test.ts pattern). */
function spyAudioLevels(engine: MockEngineAdapter) {
  const calls: Array<{ tabId: string; level: number }> = [];
  const original = engine.tabs.setAudioLevel;
  engine.tabs.setAudioLevel = async (tabId, level) => {
    calls.push({ tabId, level });
    await original(tabId, level);
  };
  return calls;
}

describe('SesMasasiService', () => {
  it('clamps to 0..1 and tracks levels itself (engine has no getAudioLevel)', async () => {
    const engine = new MockEngineAdapter();
    const calls = spyAudioLevels(engine);
    const tab = await makeTab(engine, 'https://kick.com/jahrein');
    const svc = new SesMasasiService(engine);
    await svc.init();

    await svc.setTabVolume(tab.id, 1.5);
    expect(calls.at(-1)).toEqual({ tabId: tab.id, level: 1 });
    expect(svc.getTabVolume(tab.id)).toBe(1);

    await svc.setTabVolume(tab.id, -3);
    expect(calls.at(-1)).toEqual({ tabId: tab.id, level: 0 });
    expect(svc.getTabVolume(tab.id)).toBe(0);

    await svc.setTabVolume(tab.id, 0.4);
    expect(svc.getTabVolume(tab.id)).toBe(0.4);

    // untouched tabs default to full volume
    expect(svc.getTabVolume('nonexistent')).toBe(1);
  });

  it('rolls back the tracked level when the engine call fails', async () => {
    const engine = new MockEngineAdapter();
    const tab = await makeTab(engine, 'https://kick.com/jahrein');
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(tab.id, 0.7);

    const original = engine.tabs.setAudioLevel;
    engine.tabs.setAudioLevel = async () => {
      throw new Error('IPC down');
    };
    await expect(svc.setTabVolume(tab.id, 0.2)).rejects.toThrow('IPC down');
    expect(svc.getTabVolume(tab.id)).toBe(0.7); // state stayed consistent with reality
    engine.tabs.setAudioLevel = original;
  });

  it('solo zeroes every other audible tab; clearSolo restores tracked levels exactly', async () => {
    const engine = new MockEngineAdapter();
    const music = await makeTab(engine, 'https://www.pretzel.rocks');
    const chat = await makeTab(engine, 'https://kick.com/jahrein');
    const alerts = await makeTab(engine, 'https://streamelements.com/overlay');
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(chat.id, 0.5);

    const states: SesMasasiState[] = [];
    svc.onChange((s) => states.push(s));
    const calls = spyAudioLevels(engine);

    await svc.solo(music.id);
    expect(calls).toEqual(
      expect.arrayContaining([
        { tabId: chat.id, level: 0 },
        { tabId: alerts.id, level: 0 },
      ]),
    );
    expect(calls.some((c) => c.tabId === music.id)).toBe(false); // soloed tab untouched
    expect(svc.getTabVolume(chat.id)).toBe(0.5); // tracked level survives solo

    calls.length = 0;
    await svc.clearSolo();
    expect(calls).toEqual(
      expect.arrayContaining([
        { tabId: chat.id, level: 0.5 },
        { tabId: alerts.id, level: 1 },
      ]),
    );
    expect(states).toEqual([
      { solo: music.id, ducked: false },
      { solo: null, ducked: false },
    ]);
  });

  it('closing the soloed tab auto-clears solo and restores the others', async () => {
    const engine = new MockEngineAdapter();
    const music = await makeTab(engine, 'https://www.pretzel.rocks');
    const chat = await makeTab(engine, 'https://kick.com/jahrein');
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(chat.id, 0.6);

    await svc.solo(music.id);
    const calls = spyAudioLevels(engine);
    await engine.tabs.close(music.id);
    await tick();

    expect(svc.getState()).toEqual({ solo: null, ducked: false });
    expect(calls).toContainEqual({ tabId: chat.id, level: 0.6 });
  });

  it('duck caps tabs at min(tracked, duckLevel); unduck restores exact levels', async () => {
    const engine = new MockEngineAdapter();
    const loud = await makeTab(engine, 'https://www.pretzel.rocks');
    const quiet = await makeTab(engine, 'https://kick.com/jahrein');
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(loud.id, 0.8);
    await svc.setTabVolume(quiet.id, 0.1);

    const calls = spyAudioLevels(engine);
    await svc.duck(0.2);
    expect(calls).toContainEqual({ tabId: loud.id, level: 0.2 });
    // already below the duck target: min() keeps it where it was
    expect(calls).toContainEqual({ tabId: quiet.id, level: 0.1 });
    expect(svc.getState().ducked).toBe(true);

    calls.length = 0;
    await svc.unduck();
    expect(calls).toContainEqual({ tabId: loud.id, level: 0.8 });
    expect(calls).toContainEqual({ tabId: quiet.id, level: 0.1 });
    expect(svc.getTabVolume(loud.id)).toBe(0.8);
    expect(svc.getState().ducked).toBe(false);
  });

  it('duck is idempotent; unduck without duck is a no-op', async () => {
    const engine = new MockEngineAdapter();
    await makeTab(engine, 'https://www.pretzel.rocks');
    const svc = new SesMasasiService(engine);
    await svc.init();

    const states: SesMasasiState[] = [];
    svc.onChange((s) => states.push(s));
    const calls = spyAudioLevels(engine);

    await svc.unduck(); // never ducked: nothing happens
    expect(calls).toEqual([]);

    await svc.duck(0.2);
    const afterFirst = calls.length;
    await svc.duck(0.2); // same args: zero engine calls
    expect(calls.length).toBe(afterFirst);

    await svc.unduck();
    await svc.unduck(); // second release: nothing left to restore
    expect(states).toEqual([
      { solo: null, ducked: true },
      { solo: null, ducked: false },
    ]);
  });

  it('duck respects exceptTabIds — the alert tab keeps cutting through', async () => {
    const engine = new MockEngineAdapter();
    const music = await makeTab(engine, 'https://www.pretzel.rocks');
    const alerts = await makeTab(engine, 'https://streamelements.com/overlay');
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(music.id, 0.9);

    const calls = spyAudioLevels(engine);
    await svc.duck(0.2, { exceptTabIds: [alerts.id] });
    expect(calls).toContainEqual({ tabId: music.id, level: 0.2 });
    expect(calls.some((c) => c.tabId === alerts.id)).toBe(false);
  });

  it('ducking during solo: others stay at 0, the soloed tab itself is ducked', async () => {
    const engine = new MockEngineAdapter();
    const music = await makeTab(engine, 'https://www.pretzel.rocks');
    const chat = await makeTab(engine, 'https://kick.com/jahrein');
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(music.id, 0.9);
    await svc.setTabVolume(chat.id, 0.5);
    await svc.solo(music.id);

    const calls = spyAudioLevels(engine);
    await svc.duck(0.2);
    expect(calls).toContainEqual({ tabId: music.id, level: 0.2 }); // min(0.9, 0.2)
    expect(calls.filter((c) => c.tabId === chat.id).every((c) => c.level === 0)).toBe(true);

    calls.length = 0;
    await svc.unduck();
    expect(calls).toContainEqual({ tabId: music.id, level: 0.9 });
    expect(calls.filter((c) => c.tabId === chat.id).every((c) => c.level === 0)).toBe(true);

    calls.length = 0;
    await svc.clearSolo();
    expect(calls).toContainEqual({ tabId: chat.id, level: 0.5 });
  });

  it('rememberOrigin persists to storage and re-applies on navigation to that origin', async () => {
    const engine = new MockEngineAdapter();
    const kickTab = await makeTab(engine, 'https://kick.com/jahrein');
    const otherTab = await makeTab(engine, 'https://example.com', false);
    const svc = new SesMasasiService(engine);
    await svc.init();

    await svc.setTabVolume(kickTab.id, 0.3, { rememberOrigin: true });
    expect(await engine.storage.get('sesmasasi:origins')).toEqual({ 'https://kick.com': 0.3 });

    // navigate the other tab to the remembered origin
    const calls = spyAudioLevels(engine);
    for (const t of await engine.tabs.list()) {
      if (t.id === otherTab.id) t.url = 'https://kick.com/baska-kanal';
    }
    engine.tabs.emitUpdated(otherTab.id);
    await tick();
    expect(calls).toContainEqual({ tabId: otherTab.id, level: 0.3 });
    expect(svc.getTabVolume(otherTab.id)).toBe(0.3);
  });

  it('restores remembered origin levels for already-open tabs at init', async () => {
    const engine = new MockEngineAdapter();
    await engine.storage.set('sesmasasi:origins', { 'https://kick.com': 0.25 });
    const tab = await makeTab(engine, 'https://kick.com/jahrein');
    const calls = spyAudioLevels(engine);

    const svc = new SesMasasiService(engine);
    await svc.init();
    expect(calls).toContainEqual({ tabId: tab.id, level: 0.25 });
    expect(svc.getTabVolume(tab.id)).toBe(0.25);
  });

  it('non-navigation updates never clobber a manual level', async () => {
    const engine = new MockEngineAdapter();
    await engine.storage.set('sesmasasi:origins', { 'https://kick.com': 0.25 });
    const tab = await makeTab(engine, 'https://kick.com/jahrein');
    const svc = new SesMasasiService(engine);
    await svc.init(); // applies 0.25 from the remembered origin

    await svc.setTabVolume(tab.id, 0.9); // manual tweak, no rememberOrigin
    const calls = spyAudioLevels(engine);
    for (const t of await engine.tabs.list()) {
      if (t.id === tab.id) t.audible = false; // audible flip, same URL
    }
    engine.tabs.emitUpdated(tab.id);
    await tick();
    expect(calls).toEqual([]); // same origin → no re-apply
    expect(svc.getTabVolume(tab.id)).toBe(0.9);
  });

  it('never calls setMuted — boolean mute belongs to Kalkan', async () => {
    const engine = new MockEngineAdapter();
    const music = await makeTab(engine, 'https://www.pretzel.rocks');
    const chat = await makeTab(engine, 'https://kick.com/jahrein');
    let mutedCalls = 0;
    const originalSetMuted = engine.tabs.setMuted;
    engine.tabs.setMuted = async (tabId, muted) => {
      mutedCalls++;
      await originalSetMuted(tabId, muted);
    };
    const svc = new SesMasasiService(engine);
    await svc.init();

    await svc.setTabVolume(music.id, 0.3, { rememberOrigin: true });
    await svc.solo(music.id);
    await svc.duck();
    await svc.unduck();
    await svc.clearSolo();
    expect(mutedCalls).toBe(0);
  });

  it('dispose unsubscribes from tab events but leaves volumes untouched', async () => {
    const engine = new MockEngineAdapter();
    await engine.storage.set('sesmasasi:origins', { 'https://kick.com': 0.25 });
    const music = await makeTab(engine, 'https://www.pretzel.rocks');
    const other = await makeTab(engine, 'https://example.com', false);
    const svc = new SesMasasiService(engine);
    await svc.init();
    await svc.setTabVolume(music.id, 0.4);
    await svc.solo(music.id);

    const calls = spyAudioLevels(engine);
    svc.dispose();

    // navigation after dispose: origin rule no longer applied
    for (const t of await engine.tabs.list()) {
      if (t.id === other.id) t.url = 'https://kick.com/jahrein';
    }
    engine.tabs.emitUpdated(other.id);
    // closing the soloed tab after dispose: no auto-clearSolo restore calls
    await engine.tabs.close(music.id);
    await tick();
    expect(calls).toEqual([]); // dispose does NOT touch volumes
  });
});
