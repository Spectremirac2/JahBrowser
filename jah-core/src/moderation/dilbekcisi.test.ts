import { describe, expect, it } from 'vitest';
import { DilBekcisi, normalizeTurkish } from './dilbekcisi.js';

/**
 * Fixture policy: NO real profanity in the repo. Lists are runtime config
 * (see dilbekcisi.ts header), so tests use mild invented placeholders:
 *   soft  -> 'kotusoz', 'kırıksöz'   (standalone-word semantics)
 *   hard  -> 'cirkinlaf'             (substring semantics)
 *   white -> 'cirkinlafkoy'          (fictional town containing the hard word)
 */
function makeBekci(thresholds?: ConstructorParameters<typeof DilBekcisi>[0]['thresholds']) {
  return new DilBekcisi({
    softList: ['kotusoz', 'kırıksöz'],
    hardList: ['cirkinlaf'],
    whitelist: ['Cirkinlafkoy'], // config casing is irrelevant — normalized on load
    thresholds,
  });
}

const ZWSP = String.fromCharCode(0x200b);

describe('normalizeTurkish', () => {
  it('lowercases with the Turkish locale: İ -> i and I -> ı', () => {
    expect(normalizeTurkish('İYİ')).toBe('iyi');
    // plain toLowerCase() would give 'isik' — the tr-TR locale must give 'ısık'
    expect(normalizeTurkish('ISIK')).toBe('ısık');
    expect(normalizeTurkish('DİŞ')).toBe('diş');
    expect(normalizeTurkish('DIŞ')).toBe('dış');
  });

  it('keeps Turkish letters but strips foreign diacritics', () => {
    expect(normalizeTurkish('çğışöü')).toBe('çğışöü');
    expect(normalizeTurkish('kâğıt')).toBe('kağıt'); // â -> a, ğ/ı survive
    expect(normalizeTurkish('café naïve')).toBe('cafe naive');
  });

  it('maps leet-speak substitutions to letters', () => {
    expect(normalizeTurkish('k0tu50z')).toBe('kotusoz');
    expect(normalizeTurkish('c1rk1nl4f')).toBe('cirkinlaf');
    expect(normalizeTurkish('@yıp $ey')).toBe('ayıp sey');
  });

  it('collapses 3+ repeated chars to one but keeps doubles', () => {
    expect(normalizeTurkish('kotuuuusoz')).toBe('kotusoz');
    expect(normalizeTurkish('elli')).toBe('elli'); // legit Turkish double letter
    expect(normalizeTurkish('aa')).toBe('aa');
    expect(normalizeTurkish('aaaa')).toBe('a');
  });

  it('strips separators inside single-letter runs without merging words', () => {
    expect(normalizeTurkish('k.o.t.u.s.o.z')).toBe('kotusoz');
    expect(normalizeTurkish('k o t u s o z')).toBe('kotusoz');
    expect(normalizeTurkish('bu k.o.t.u.s.o.z olur')).toBe('bu kotusoz olur');
    // ordinary words keep their boundaries
    expect(normalizeTurkish('kotu soz')).toBe('kotu soz');
    expect(normalizeTurkish('merhaba, nasılsın?')).toBe('merhaba, nasılsın?');
  });

  it('handles combined evasion: casing + leet + separators', () => {
    expect(normalizeTurkish('K.0.T.U.5.0.Z')).toBe('kotusoz');
  });

  it('removes invisible characters (zero-width space etc.)', () => {
    expect(normalizeTurkish(`kotu${ZWSP}soz`)).toBe('kotusoz');
  });
});

describe('DilBekcisi.check', () => {
  it('returns clean for harmless messages', () => {
    const result = makeBekci().check('selam reyiz bugün yayın harika');
    expect(result).toEqual({ verdict: 'clean', matches: [] });
  });

  it('flags a soft word only as a standalone word, with the original index', () => {
    const result = makeBekci().check('bu kotusoz oldu');
    expect(result.verdict).toBe('soft');
    expect(result.matches).toEqual([{ word: 'kotusoz', index: 3 }]);
  });

  it('does NOT flag a soft word inside a longer word (no substring false positive)', () => {
    expect(makeBekci().check('kotusozluk yapma').verdict).toBe('clean');
    expect(makeBekci().check('okotusoz').verdict).toBe('clean');
  });

  it('flags a hard word even when suffixed (Turkish agglutination)', () => {
    const result = makeBekci().check('cirkinlaflar yazma');
    expect(result.verdict).toBe('hard');
    expect(result.matches).toEqual([{ word: 'cirkinlaf', index: 0 }]);
  });

  it('whitelist wins: a hard word inside a whitelisted word is not flagged', () => {
    // classic Scunthorpe: fictional town name contains the hard word
    expect(makeBekci().check('cirkinlafkoy çok güzel bir yer').verdict).toBe('clean');
  });

  it('whitelist also covers Turkish suffixed forms of the whitelisted word', () => {
    expect(makeBekci().check('ben cirkinlafkoyluyum').verdict).toBe('clean');
  });

  it('whitelist does not protect the bare listed word', () => {
    expect(makeBekci().check('cirkinlaf dedi').verdict).toBe('hard');
  });

  it('catches İ/ı casing evasion via the tr-TR locale', () => {
    // 'KIRIKSÖZ'.toLowerCase() would be 'kiriksöz' and miss the list entry
    const result = makeBekci().check('KIRIKSÖZ YAZDIN');
    expect(result.verdict).toBe('soft');
    expect(result.matches).toEqual([{ word: 'kırıksöz', index: 0 }]);
  });

  it('catches leet-speak evasion', () => {
    const result = makeBekci().check('tam bir k0tu50z');
    expect(result.verdict).toBe('soft');
    expect(result.matches).toEqual([{ word: 'kotusoz', index: 8 }]);
  });

  it('catches separator evasion', () => {
    const result = makeBekci().check('k.o.t.u.s.o.z dedi');
    expect(result.verdict).toBe('soft');
    expect(result.matches).toEqual([{ word: 'kotusoz', index: 0 }]);
  });

  it('catches repeated-char and zero-width evasion', () => {
    expect(makeBekci().check('kotuuuusoz').verdict).toBe('soft');
    expect(makeBekci().check(`kotu${ZWSP}soz`).verdict).toBe('soft');
  });

  it('maps match indexes back through normalization shifts (best effort)', () => {
    // 'aaaa ' collapses to 'a ' — the match index must still point into the original
    const result = makeBekci().check('aaaa kotusoz');
    expect(result.matches).toEqual([{ word: 'kotusoz', index: 5 }]);
  });

  it('hard beats soft and matches come back sorted by position', () => {
    const result = makeBekci().check('kotusoz ve cirkinlaflar');
    expect(result.verdict).toBe('hard');
    expect(result.matches).toEqual([
      { word: 'kotusoz', index: 0 },
      { word: 'cirkinlaf', index: 11 },
    ]);
  });

  it('works with empty lists', () => {
    const bekci = new DilBekcisi({ softList: [], hardList: [] });
    expect(bekci.check('herhangi bir mesaj')).toEqual({ verdict: 'clean', matches: [] });
  });
});

describe('DilBekcisi.suggestAction', () => {
  it('maps clean to none regardless of repeat count', () => {
    const bekci = makeBekci();
    expect(bekci.suggestAction('clean')).toBe('none');
    expect(bekci.suggestAction('clean', 10)).toBe('none');
  });

  it('escalates soft: flag -> delete -> delete+timeout with default thresholds', () => {
    const bekci = makeBekci();
    expect(bekci.suggestAction('soft')).toBe('flag'); // 1st offense
    expect(bekci.suggestAction('soft', 1)).toBe('flag'); // 2nd
    expect(bekci.suggestAction('soft', 2)).toBe('delete'); // 3rd (softDeleteAfter=3)
    expect(bekci.suggestAction('soft', 4)).toBe('delete+timeout'); // 5th (softTimeoutAfter=5)
  });

  it('escalates hard: delete -> delete+timeout with default thresholds', () => {
    const bekci = makeBekci();
    expect(bekci.suggestAction('hard')).toBe('delete'); // 1st offense
    expect(bekci.suggestAction('hard', 1)).toBe('delete+timeout'); // 2nd (hardTimeoutAfter=2)
  });

  it('honors custom thresholds', () => {
    const strict = makeBekci({ softDeleteAfter: 1, hardTimeoutAfter: 1 });
    expect(strict.suggestAction('soft')).toBe('delete');
    expect(strict.suggestAction('hard')).toBe('delete+timeout');

    const lenient = makeBekci({ softTimeoutAfter: 2, softDeleteAfter: 2 });
    expect(lenient.suggestAction('soft', 1)).toBe('delete+timeout');
  });
});
