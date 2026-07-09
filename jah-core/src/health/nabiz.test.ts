import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import type { ObsStreamStatus } from '../obs/client.js';
import { NabizService, type NabizObsSource, type NabizState } from './nabiz.js';

/** Scripted OBS fake: getStreamStatus consumes a queue of statuses/errors. */
class FakeObs implements NabizObsSource {
  private queue: Array<ObsStreamStatus | Error> = [];
  private stateCbs = new Set<(active: boolean) => void>();

  push(...items: Array<ObsStreamStatus | Error>): void {
    this.queue.push(...items);
  }

  async getStreamStatus(): Promise<ObsStreamStatus> {
    const next = this.queue.shift();
    if (next === undefined) throw new Error('FakeObs: script exhausted');
    if (next instanceof Error) throw next;
    return next;
  }

  onStreamStateChanged(cb: (active: boolean) => void) {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  emitStreamState(active: boolean): void {
    for (const cb of this.stateCbs) cb(active);
  }

  get subscriberCount(): number {
    return this.stateCbs.size;
  }
}

function status(over: Partial<ObsStreamStatus> = {}): ObsStreamStatus {
  return {
    outputActive: true,
    outputReconnecting: false,
    outputTimecode: '00:10:00.000',
    outputDuration: 600_000,
    outputCongestion: 0,
    outputBytes: 0,
    outputSkippedFrames: 0,
    outputTotalFrames: 0,
    ...over,
  };
}

/** Shorthand: healthy active stream with the given frame counters. */
function frames(skipped: number, total: number): ObsStreamStatus {
  return status({ outputSkippedFrames: skipped, outputTotalFrames: total });
}

function setup() {
  const engine = new MockEngineAdapter();
  const obs = new FakeObs();
  const svc = new NabizService(engine, obs, { intervalMs: 60_000 });
  const changes: NabizState[] = [];
  svc.onStateChange((s) => changes.push(s));
  return { engine, obs, svc, changes };
}

describe('NabizService', () => {
  it('starts as veri-yok and reaches iyi only after the debounce window', async () => {
    const { engine, obs, svc, changes } = setup();
    expect(svc.getState()).toBe('veri-yok');
    expect(svc.getLastSample()).toBeUndefined();

    obs.push(frames(0, 100), frames(0, 200));
    await svc.pollNow(); // first good reading: pending, not committed yet
    expect(svc.getState()).toBe('veri-yok');
    await svc.pollNow(); // second consecutive reading commits
    expect(svc.getState()).toBe('iyi');
    expect(changes).toEqual(['iyi']);
    expect(svc.getLastSample()?.skipRate).toBe(0);
    expect(engine.notifications.shown).toHaveLength(0); // iyi never notifies
  });

  it('computes skip rate from counter DELTAS: >2% for 2 polls -> uyari with one notification', async () => {
    const { engine, obs, svc, changes } = setup();
    obs.push(frames(0, 100), frames(0, 200));
    await svc.pollNow();
    await svc.pollNow(); // iyi

    // 5 skipped over 100 new frames = 5% > warn(2%), < crit(10%)
    obs.push(frames(5, 300), frames(10, 400));
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi'); // debounce: 1 bad poll is not enough
    await svc.pollNow();
    expect(svc.getState()).toBe('uyari');
    expect(svc.getLastSample()?.skipRate).toBeCloseTo(0.05);
    expect(engine.notifications.shown).toHaveLength(1);
    expect(engine.notifications.shown[0].title).toBe('Yayın sağlığı: uyarı');
    expect(engine.notifications.shown[0].body).toContain('bitrate/internet kontrol et');

    // Staying in uyari must NOT re-notify (transition-only, no spam).
    obs.push(frames(15, 500), frames(20, 600));
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('uyari');
    expect(engine.notifications.shown).toHaveLength(1);
    expect(changes).toEqual(['iyi', 'uyari']);
  });

  it('debounce swallows a single bad poll (flap guard): no transition, no notification', async () => {
    const { engine, obs, svc, changes } = setup();
    obs.push(frames(0, 100), frames(0, 200));
    await svc.pollNow();
    await svc.pollNow(); // iyi

    // One 50% spike, then clean again — must never surface.
    obs.push(frames(50, 300), frames(50, 400), frames(50, 500));
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi');
    await svc.pollNow(); // 0/100 delta: healthy, pending kritik discarded
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi');
    expect(changes).toEqual(['iyi']);
    expect(engine.notifications.shown).toHaveLength(0);
  });

  it('escalates uyari -> kritik above 10% and notifies once per transition', async () => {
    const { engine, obs, svc, changes } = setup();
    obs.push(frames(0, 100), frames(0, 200));
    await svc.pollNow();
    await svc.pollNow(); // iyi

    obs.push(frames(5, 300), frames(10, 400)); // 5% x2 -> uyari
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('uyari');

    obs.push(frames(30, 500), frames(50, 600)); // 20% x2 -> kritik
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('kritik');
    expect(changes).toEqual(['iyi', 'uyari', 'kritik']);
    expect(engine.notifications.shown).toHaveLength(2);
    expect(engine.notifications.shown[1].title).toBe('Yayın sağlığı: kritik');
    expect(engine.notifications.shown[1].body).toContain('kare kaybı');
  });

  it('outputReconnecting forces kritik even with a clean skip rate', async () => {
    const { engine, obs, svc } = setup();
    obs.push(frames(0, 100), frames(0, 200));
    await svc.pollNow();
    await svc.pollNow(); // iyi

    obs.push(
      status({ outputReconnecting: true, outputTotalFrames: 300 }),
      status({ outputReconnecting: true, outputTotalFrames: 400 }),
    );
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('kritik');
    expect(engine.notifications.shown).toHaveLength(1);
    expect(engine.notifications.shown[0].title).toBe('Yayın sağlığı: KOPTU');
    expect(engine.notifications.shown[0].body).toContain('yeniden bağlanmaya');
  });

  it('obs unreachable -> veri-yok (no notification), recovery restarts the baseline cleanly', async () => {
    const { engine, obs, svc, changes } = setup();
    obs.push(frames(0, 5000), frames(10, 10_000));
    await svc.pollNow();
    await svc.pollNow(); // iyi (10/5000 = 0.2%)

    obs.push(new Error('obs down'), new Error('obs down'));
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi'); // even veri-yok is debounced
    await svc.pollNow();
    expect(svc.getState()).toBe('veri-yok');
    expect(engine.notifications.shown).toHaveLength(0); // veri-yok never notifies

    // OBS is back with RESET counters (new stream). Without a baseline reset
    // this would read as a giant negative/bogus delta — it must read as 0.
    obs.push(frames(0, 50), frames(0, 150));
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi');
    expect(svc.getLastSample()?.skipRate).toBe(0);
    expect(changes).toEqual(['iyi', 'veri-yok', 'iyi']);
  });

  it('counters going backwards mid-run (stream restart) never produce a bogus rate', async () => {
    const { engine, obs, svc } = setup();
    obs.push(frames(0, 5000), frames(10, 10_000));
    await svc.pollNow();
    await svc.pollNow(); // iyi

    obs.push(frames(0, 100), frames(0, 200)); // totals dropped: fresh stream
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi');
    expect(svc.getLastSample()?.skipRate).toBe(0);
    expect(engine.notifications.shown).toHaveLength(0);
  });

  it('outputActive=false polls -> veri-yok, last good sample retained', async () => {
    const { obs, svc, changes } = setup();
    obs.push(frames(0, 100), frames(2, 200));
    await svc.pollNow();
    await svc.pollNow(); // iyi

    obs.push(status({ outputActive: false }), status({ outputActive: false }));
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('veri-yok');
    expect(changes).toEqual(['iyi', 'veri-yok']);
    // Sample stays from the last ACTIVE poll — inactive status carries no health data.
    expect(svc.getLastSample()?.status.outputTotalFrames).toBe(200);
  });

  it('start() subscribes to push events: stream-stopped flips to veri-yok instantly; stop() unsubscribes', async () => {
    const { obs, svc, changes } = setup();
    for (let i = 1; i <= 10; i++) obs.push(frames(0, i * 100));

    svc.start();
    expect(obs.subscriberCount).toBe(1);
    // start() fires one coalesced immediate poll; drive enough awaited polls
    // to pass the debounce window regardless of that overlap.
    for (let i = 0; i < 5; i++) await svc.pollNow();
    expect(svc.getState()).toBe('iyi');

    // Terminal STOPPED push is definitive — no debounce, immediate veri-yok.
    obs.emitStreamState(false);
    expect(svc.getState()).toBe('veri-yok');
    expect(changes).toEqual(['iyi', 'veri-yok']);

    svc.stop();
    expect(obs.subscriberCount).toBe(0);
  });

  it('stream-started push resets the frame baseline so the first poll of a new stream is clean', async () => {
    const { obs, svc } = setup();
    for (let i = 1; i <= 6; i++) obs.push(frames(0, i * 1000));
    svc.start();
    for (let i = 0; i < 5; i++) await svc.pollNow();
    expect(svc.getState()).toBe('iyi');

    obs.emitStreamState(true); // new stream: counters restart at zero
    obs.push(frames(0, 40), frames(0, 80)); // way below the old baseline
    await svc.pollNow();
    await svc.pollNow();
    expect(svc.getState()).toBe('iyi');
    expect(svc.getLastSample()?.skipRate).toBe(0);
    svc.stop();
  });
});
