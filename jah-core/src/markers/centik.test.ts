import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import { CentikService } from './centik.js';

function fixedClock(startIso: string) {
  let offsetSec = 0;
  return {
    now: () => new Date(new Date(startIso).getTime() + offsetSec * 1000),
    advance: (sec: number) => {
      offsetSec += sec;
    },
  };
}

describe('CentikService', () => {
  it('records markers with stream offsets and exports them', async () => {
    const engine = new MockEngineAdapter();
    const clock = fixedClock('2026-07-04T19:00:00.000Z');
    const centik = new CentikService(engine, clock.now);

    await centik.startSession();
    clock.advance(65); // 00:01:05
    await centik.add('ilk kesitlik an');
    clock.advance(3600); // 01:01:05
    await centik.add();

    const markers = centik.list();
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ id: '1', elapsedSec: 65, note: 'ilk kesitlik an' });
    expect(markers[1]).toMatchObject({ id: '2', elapsedSec: 3665 });

    expect(centik.exportVodLinks('https://kick.com/video/abc')).toEqual([
      'https://kick.com/video/abc?t=0h01m05s',
      'https://kick.com/video/abc?t=1h01m05s',
    ]);

    const csv = centik.exportCsv().split('\n');
    expect(csv[0]).toBe('id,at,elapsedSec,note');
    expect(csv[1]).toContain('"ilk kesitlik an"');

    expect(engine.notifications.shown).toHaveLength(2);
    expect(engine.notifications.shown[0].title).toBe('Çentik atıldı (00:01:05)');
  });

  it('recovers an interrupted session after a crash (restore)', async () => {
    const engine = new MockEngineAdapter();
    const clock = fixedClock('2026-07-04T19:00:00.000Z');
    const centik1 = new CentikService(engine, clock.now);
    await centik1.startSession();
    clock.advance(120);
    await centik1.add('crash öncesi an');

    // "crash": aynı storage, yeni servis örneği
    const centik2 = new CentikService(engine, clock.now);
    expect(await centik2.restore()).toBe(true);
    expect(centik2.list()).toHaveLength(1);
    expect(centik2.list()[0].note).toBe('crash öncesi an');

    // oturum bağlamı da geri geldi: yeni çentik doğru offset alır
    clock.advance(60); // 00:03:00
    const marker = await centik2.add();
    expect(marker.elapsedSec).toBe(180);
    expect(marker.id).toBe('2'); // id sayacı da kurtarıldı — çakışma yok
  });

  it('endSession archives to last-session and clears current', async () => {
    const engine = new MockEngineAdapter();
    const clock = fixedClock('2026-07-04T19:00:00.000Z');
    const centik = new CentikService(engine, clock.now);
    await centik.startSession();
    clock.advance(30);
    await centik.add('tek an');

    const finished = await centik.endSession();
    expect(finished).toHaveLength(1);
    expect(centik.list()).toHaveLength(0);
    expect(await engine.storage.get('centik:current-session')).toBeUndefined();
    expect(await centik.loadLastSession()).toHaveLength(1);

    // restore artık false döner: aktif oturum yok
    const fresh = new CentikService(engine, clock.now);
    expect(await fresh.restore()).toBe(false);
  });

  it('marks without offset when no session is active', async () => {
    const engine = new MockEngineAdapter();
    const centik = new CentikService(engine, fixedClock('2026-07-04T19:00:00.000Z').now);
    const marker = await centik.add('session yok');
    expect(marker.elapsedSec).toBeNull();
    expect(centik.exportVodLinks('https://kick.com/video/abc')).toEqual([]);
  });
});
