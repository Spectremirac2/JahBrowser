import { describe, expect, it } from 'vitest';
import type { KickChatMessage } from '../platform/kick/types.js';
import { KismetService, createCryptoRng } from './kismet.js';

let nextId = 0;
function msg(senderUsername: string, content: string, badges: string[] = []): KickChatMessage {
  return {
    id: `m${++nextId}`,
    chatroomId: 1,
    senderUsername,
    content,
    createdAt: '2026-07-04T20:00:00Z',
    badges,
  };
}

/** Deterministic rng: yields the given values in order, then repeats the last. */
function rngSeq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('KismetService keyword matching', () => {
  it('matches Turkish-locale case-insensitively (İ/ı) after trimming', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });

    // tr-TR: 'I' lowercases to 'ı' — plain toLowerCase would give 'i' and miss.
    expect(kismet.feed(msg('aslan', '!KATIL'))).toBeDefined();
    expect(kismet.feed(msg('kaplan', '  !Katıl  '))).toBeDefined();
    expect(kismet.entryCount).toBe(2);
  });

  it('matches dotted İ keyword against lowercase i content', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!İZMİR' });

    expect(kismet.feed(msg('ege', '!izmir'))).toBeDefined();
    expect(kismet.feed(msg('deniz', '!IZMIR'))).toBeUndefined(); // tr: I -> ı, not i
    expect(kismet.entryCount).toBe(1);
  });

  it('accepts keyword followed by whitespace but rejects prefix words', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });

    expect(kismet.feed(msg('a', '!katıl hediye çok iyi'))).toBeDefined();
    expect(kismet.feed(msg('b', '!katılmıyorum'))).toBeUndefined(); // startsWith tuzağı
    expect(kismet.feed(msg('c', 'ben !katıl'))).toBeUndefined(); // keyword must lead
    expect(kismet.entryCount).toBe(1);
  });

  it('rejects an empty keyword with a Turkish error', () => {
    const kismet = new KismetService(rngSeq(0));
    expect(() => kismet.start({ keyword: '   ' })).toThrow('anahtar kelime');
  });
});

describe('KismetService entries', () => {
  it('blocks duplicate entries per user, case-insensitively', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });

    expect(kismet.feed(msg('Jahzara', '!katıl'))).toBeDefined();
    expect(kismet.feed(msg('Jahzara', '!katıl'))).toBeUndefined();
    expect(kismet.feed(msg('JAHZARA', '!katıl'))).toBeUndefined();
    expect(kismet.entryCount).toBe(1);
    expect(kismet.entries()).toEqual([{ username: 'Jahzara', weight: 1 }]);
  });

  it('assigns the highest matching subluck badge weight, default 1', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl', subluck: { subscriber: 2, og: 3 } });

    kismet.feed(msg('pleb', '!katıl'));
    kismet.feed(msg('sub', '!katıl', ['subscriber']));
    kismet.feed(msg('veteran', '!katıl', ['subscriber', 'og'])); // max wins -> 3
    kismet.feed(msg('mod', '!katıl', ['moderator'])); // no subluck entry -> 1

    const byName = new Map(kismet.entries().map((e) => [e.username, e.weight]));
    expect(byName.get('pleb')).toBe(1);
    expect(byName.get('sub')).toBe(2);
    expect(byName.get('veteran')).toBe(3);
    expect(byName.get('mod')).toBe(1);
  });

  it('ignores feeds before start and after end', () => {
    const kismet = new KismetService(rngSeq(0));
    expect(kismet.feed(msg('early', '!katıl'))).toBeUndefined();
    expect(kismet.entryCount).toBe(0);

    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('ontime', '!katıl'));
    kismet.end();

    expect(kismet.feed(msg('late', '!katıl'))).toBeUndefined();
    expect(kismet.entryCount).toBe(1);
  });

  it('notifies onEntry listeners and honors unsubscribe', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });
    const seen: string[] = [];
    const unsub = kismet.onEntry((e) => seen.push(e.username));

    kismet.feed(msg('bir', '!katıl'));
    unsub();
    kismet.feed(msg('iki', '!katıl'));
    expect(seen).toEqual(['bir']);
  });
});

describe('KismetService draws', () => {
  it('weighted draw is deterministic under a stubbed rng', () => {
    // Pool: ada(w1) [0,1) + veli(w3) [1,4), total 4.
    const kismet = new KismetService(rngSeq(0.5)); // 0.5 * 4 = 2 -> veli's slice
    kismet.start({ keyword: '!katıl', subluck: { og: 3 } });
    kismet.feed(msg('ada', '!katıl'));
    kismet.feed(msg('veli', '!katıl', ['og']));

    expect(kismet.drawWinners()).toEqual([{ username: 'veli', weight: 3 }]);
  });

  it('low rng lands in the first (unweighted) slice', () => {
    const kismet = new KismetService(rngSeq(0.1)); // 0.1 * 4 = 0.4 -> ada's slice
    kismet.start({ keyword: '!katıl', subluck: { og: 3 } });
    kismet.feed(msg('ada', '!katıl'));
    kismet.feed(msg('veli', '!katıl', ['og']));

    expect(kismet.drawWinners()).toEqual([{ username: 'ada', weight: 1 }]);
  });

  it('draws without replacement: a winner cannot win again, reroll = call again', () => {
    // rng 0 always picks the first remaining candidate -> insertion order.
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('bir', '!katıl'));
    kismet.feed(msg('iki', '!katıl'));
    kismet.feed(msg('üç', '!katıl'));

    const first = kismet.drawWinners(2);
    expect(first.map((w) => w.username)).toEqual(['bir', 'iki']);
    expect(kismet.entryCount).toBe(1);

    const reroll = kismet.drawWinners(); // only 'üç' left — repeats impossible
    expect(reroll.map((w) => w.username)).toEqual(['üç']);
    expect(kismet.entryCount).toBe(0);
    expect(kismet.drawWinners(5)).toEqual([]); // empty pool: no winners, no crash
  });

  it('drawing more than the pool returns everyone exactly once', () => {
    const kismet = new KismetService(rngSeq(0.99));
    kismet.start({ keyword: '!katıl', subluck: { subscriber: 2 } });
    kismet.feed(msg('a', '!katıl'));
    kismet.feed(msg('b', '!katıl', ['subscriber']));

    const winners = kismet.drawWinners(10);
    expect(winners.map((w) => w.username).sort()).toEqual(['a', 'b']);
    expect(kismet.entryCount).toBe(0);
  });

  it('rng at the float edge (~1) still picks a valid candidate', () => {
    const kismet = new KismetService(rngSeq(0.999999999));
    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('tek', '!katıl'));
    expect(kismet.drawWinners()[0].username).toBe('tek');
  });

  it('notifies onWinner per drawn winner', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('bir', '!katıl'));
    kismet.feed(msg('iki', '!katıl'));
    const winners: string[] = [];
    kismet.onWinner((w) => winners.push(w.username));

    kismet.drawWinners(2);
    expect(winners).toEqual(['bir', 'iki']);
  });
});

describe('KismetService snapshot & lifecycle', () => {
  it('exposes the { running, keyword, entries, winners } shape for the overlay', () => {
    const kismet = new KismetService(rngSeq(0));
    expect(kismet.getSnapshot()).toEqual({ running: false, keyword: '', entries: [], winners: [] });

    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('bir', '!katıl'));
    kismet.feed(msg('iki', '!katıl'));
    kismet.drawWinners();

    expect(kismet.getSnapshot()).toEqual({
      running: true,
      keyword: '!katıl',
      entries: [{ username: 'iki', weight: 1 }],
      winners: [{ username: 'bir', weight: 1 }],
    });

    const final = kismet.end();
    expect(final.running).toBe(false);
    expect(final.keyword).toBe('!katıl'); // keyword survives end for the overlay
    expect(final.winners).toEqual([{ username: 'bir', weight: 1 }]);
  });

  it('snapshot is a copy — mutating it never touches internal state', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('bir', '!katıl'));

    const snap = kismet.getSnapshot();
    snap.entries[0].weight = 999;
    snap.entries.pop();
    expect(kismet.entries()).toEqual([{ username: 'bir', weight: 1 }]);
  });

  it('restart resets entries and winners for a fresh round', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('eski', '!katıl'));
    kismet.drawWinners();

    kismet.start({ keyword: '!çekiliş' });
    expect(kismet.getSnapshot()).toEqual({
      running: true,
      keyword: '!çekiliş',
      entries: [],
      winners: [],
    });
    expect(kismet.feed(msg('eski', '!çekiliş'))).toBeDefined(); // eligible again
  });

  it('dispose stops the round and silences listeners', () => {
    const kismet = new KismetService(rngSeq(0));
    kismet.start({ keyword: '!katıl' });
    kismet.feed(msg('bir', '!katıl'));
    let calls = 0;
    kismet.onEntry(() => calls++);

    kismet.dispose();
    expect(kismet.isRunning()).toBe(false);
    expect(kismet.entryCount).toBe(0);
    expect(kismet.feed(msg('iki', '!katıl'))).toBeUndefined();
    expect(calls).toBe(0);
  });
});

describe('createCryptoRng', () => {
  it('yields values in [0, 1)', () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
