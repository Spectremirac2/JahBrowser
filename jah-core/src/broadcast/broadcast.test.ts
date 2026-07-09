import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import { BroadcastModeService } from './mode.js';
import { KalkanService } from './kalkan.js';

describe('BroadcastModeService', () => {
  it('flips engine broadcast mode and notifies listeners exactly once per change', async () => {
    const engine = new MockEngineAdapter();
    const svc = new BroadcastModeService(engine);
    await svc.init();
    const changes: boolean[] = [];
    svc.onChange((on) => changes.push(on));

    await svc.enable();
    expect(svc.isOn()).toBe(true);
    expect(await engine.capture.isBroadcastMode()).toBe(true);

    await svc.enable(); // idempotent: no duplicate event
    await svc.disable();
    expect(changes).toEqual([true, false]);
  });

  it('does not desync when the engine call fails', async () => {
    const engine = new MockEngineAdapter();
    const original = engine.capture.setBroadcastMode;
    let fail = true;
    engine.capture.setBroadcastMode = async (on) => {
      if (fail) throw new Error('IPC down');
      await original(on);
    };
    const svc = new BroadcastModeService(engine);
    await svc.init();

    await expect(svc.enable()).rejects.toThrow('IPC down');
    expect(svc.isOn()).toBe(false); // state stayed consistent with reality

    fail = false;
    await svc.enable(); // retry is NOT a no-op
    expect(svc.isOn()).toBe(true);
    expect(await engine.capture.isBroadcastMode()).toBe(true);
  });

  it('hydrates from engine state and tracks engine-initiated changes', async () => {
    const engine = new MockEngineAdapter();
    await engine.capture.setBroadcastMode(true); // engine restored state at startup
    const svc = new BroadcastModeService(engine);
    await svc.init();
    expect(svc.isOn()).toBe(true);

    const changes: boolean[] = [];
    svc.onChange((on) => changes.push(on));
    await engine.capture.setBroadcastMode(false); // engine-side change
    expect(svc.isOn()).toBe(false);
    expect(changes).toEqual([false]);
  });

  it('follows OBS stream state when auto-follow is on', async () => {
    const engine = new MockEngineAdapter();
    const svc = new BroadcastModeService(engine);
    await svc.init();

    await svc.handleObsStreamState(true);
    expect(svc.isOn()).toBe(true);

    svc.setAutoFollowObs(false);
    await svc.handleObsStreamState(false);
    expect(svc.isOn()).toBe(true); // auto-follow off: state untouched
  });
});

describe('KalkanService', () => {
  it('Ses Kalkanı mutes audible tabs, catches newly-audible ones, and restores only its own mutes', async () => {
    const engine = new MockEngineAdapter();
    const gameTab = await engine.tabs.create({ url: 'https://kick.com/jahrein' });
    const musicTab = await engine.tabs.create({ url: 'https://open.spotify.com' });
    const userMutedTab = await engine.tabs.create({ url: 'https://youtube.com' });
    (await engine.tabs.list()).forEach((t) => {
      if (t.id !== gameTab.id) return;
    });
    // durum hazırlığı: game+music sesli; userMuted kullanıcı tarafından zaten susturulmuş
    for (const t of await engine.tabs.list()) {
      if (t.id === gameTab.id || t.id === musicTab.id) t.audible = true;
      if (t.id === userMutedTab.id) {
        t.audible = true;
        t.muted = true;
      }
    }

    const broadcast = new BroadcastModeService(engine);
    const kalkan = new KalkanService(engine, broadcast);

    await kalkan.toggleSesKalkani();
    expect(kalkan.isSesKalkaniActive()).toBe(true);
    let tabs = await engine.tabs.list();
    expect(tabs.find((t) => t.id === gameTab.id)?.muted).toBe(true);
    expect(tabs.find((t) => t.id === musicTab.id)?.muted).toBe(true);

    // panik SIRASINDA ses açan yeni sekme de susturulur (sistemik sessizlik)
    const lateTab = await engine.tabs.create({ url: 'https://x.com' });
    for (const t of await engine.tabs.list()) if (t.id === lateTab.id) t.audible = true;
    engine.tabs.emitUpdated(lateTab.id);
    await new Promise((r) => setTimeout(r, 0));
    tabs = await engine.tabs.list();
    expect(tabs.find((t) => t.id === lateTab.id)?.muted).toBe(true);

    await kalkan.toggleSesKalkani();
    expect(kalkan.isSesKalkaniActive()).toBe(false);
    tabs = await engine.tabs.list();
    expect(tabs.find((t) => t.id === gameTab.id)?.muted).toBe(false);
    expect(tabs.find((t) => t.id === musicTab.id)?.muted).toBe(false);
    expect(tabs.find((t) => t.id === lateTab.id)?.muted).toBe(false);
    // kullanıcının kendi mute'u Kalkan'a ait değil: dokunulmaz
    expect(tabs.find((t) => t.id === userMutedTab.id)?.muted).toBe(true);
  });

  it('release survives tabs closed while muted', async () => {
    const engine = new MockEngineAdapter();
    const tab1 = await engine.tabs.create({ url: 'https://kick.com/jahrein' });
    const tab2 = await engine.tabs.create({ url: 'https://open.spotify.com' });
    for (const t of await engine.tabs.list()) t.audible = true;

    const kalkan = new KalkanService(engine, new BroadcastModeService(engine));
    await kalkan.engageSesKalkani();

    await engine.tabs.close(tab1.id); // muted tab dies mid-panic

    await kalkan.releaseSesKalkani(); // must not throw, must unmute survivors
    expect(kalkan.isSesKalkaniActive()).toBe(false);
    const tabs = await engine.tabs.list();
    expect(tabs.find((t) => t.id === tab2.id)?.muted).toBe(false);
  });

  it('Sahne Kalkanı hotkey force-enables Yayın Modu; re-register is idempotent', async () => {
    const engine = new MockEngineAdapter();
    const broadcast = new BroadcastModeService(engine);
    await broadcast.init();
    const kalkan = new KalkanService(engine, broadcast);

    await kalkan.registerHotkeys();
    await kalkan.registerHotkeys(); // ikinci çağrı öncekini bırakır — mock çift kayıtta fırlatırdı

    expect([...engine.hotkeys.registered.keys()]).toEqual(['Ctrl+Shift+F9', 'Ctrl+Shift+F10']);
    engine.hotkeys.registered.get('Ctrl+Shift+F10')!();
    await new Promise((r) => setTimeout(r, 0));
    expect(broadcast.isOn()).toBe(true);
  });
});
