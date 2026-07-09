/**
 * "Dil Bekçisi" — Turkish toxicity/profanity filter core (P1 moderation).
 *
 * Design background: research/10-yayinci-derinlesme/chat-moderasyon.md §7.
 * Turkish chat evasion techniques (vowel/leet substitution a->@ i->1,
 * letter repetition, separator insertion k.u.f.u.r) defeat naive word-list
 * matching, while short Turkish profanity roots inside innocent words make
 * substring matching fire false positives (the Scunthorpe problem, which is
 * worse in Turkish). This module therefore:
 *
 *   1. Normalizes text aggressively (tr-TR lowercase, leet map, separator
 *      stripping, repeat collapsing) before matching.
 *   2. Splits the corpus into a `softList` (short/ambiguous roots — matched
 *      ONLY as standalone words) and a `hardList` (unambiguous heavy terms —
 *      also matched as substrings, which catches Turkish agglutinative
 *      suffixes). This soft/hard split mirrors the 90pixel/kufur-filtresi
 *      convention cited in the research doc.
 *   3. Lets a `whitelist` override both lists (city names etc. that contain
 *      an incidental banned substring).
 *
 * KVKK / updatability: NO profanity corpus is embedded here. Word lists are
 * runtime configuration injected by the caller (remote-updatable config,
 * user overrides). This file is pure logic — no engine, no network.
 */

export type Verdict = 'clean' | 'soft' | 'hard';

export type SuggestedAction = 'none' | 'flag' | 'delete' | 'delete+timeout';

export interface DilBekcisiMatch {
  /** The list entry that matched, exactly as it was configured. */
  word: string;
  /**
   * Best-effort index of the match start in the ORIGINAL message (before
   * normalization). Always points at the original character that produced
   * the first normalized character of the match.
   */
  index: number;
}

export interface DilBekcisiResult {
  verdict: Verdict;
  /** All surviving matches (whitelist-suppressed ones excluded), sorted by index. */
  matches: DilBekcisiMatch[];
}

/**
 * Repeat-offender thresholds, counted in offenses (1 = first offense).
 * `suggestAction` receives the number of PRIOR offenses; the current message
 * is offense number `repeatCount + 1`.
 */
export interface ActionThresholds {
  /** Soft offense number at which 'flag' escalates to 'delete'. */
  softDeleteAfter: number;
  /** Soft offense number at which 'delete' escalates to 'delete+timeout'. */
  softTimeoutAfter: number;
  /** Hard offense number at which 'delete' escalates to 'delete+timeout'. */
  hardTimeoutAfter: number;
}

export interface DilBekcisiConfig {
  /**
   * Ambiguous/short roots: matched only as standalone words on the
   * normalized text (word-boundary on both sides).
   */
  softList: string[];
  /**
   * Unambiguous heavy terms: matched anywhere, including inside longer
   * words — catches Turkish suffixed forms. Whitelist still wins.
   */
  hardList: string[];
  /**
   * Innocent words that contain a listed term (Scunthorpe guard). A list
   * match is suppressed when it falls inside an occurrence of a whitelisted
   * word. The protected span extends over trailing word characters, so a
   * whitelisted stem also protects its agglutinated forms
   * ("<city>" whitelists "<city>lu", "<city>dan", ...).
   */
  whitelist?: string[];
  thresholds?: Partial<ActionThresholds>;
}

const DEFAULT_THRESHOLDS: ActionThresholds = {
  softDeleteAfter: 3,
  softTimeoutAfter: 5,
  hardTimeoutAfter: 2,
};

/**
 * Leet-speak substitutions applied during normalization. Keys must be
 * single code points, already lowercase. Values are plain letters.
 */
const LEET_MAP: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '+': 't',
  '!': 'i',
  '€': 'e',
};

/**
 * Turkish-meaningful lowercase letters that must survive diacritic
 * stripping: they are distinct letters of the alphabet, not decorations
 * (dış != diş). Everything else gets its combining marks removed
 * (â->a, é->e, î->i ...).
 */
const TURKISH_LETTERS = new Set(['ç', 'ğ', 'ı', 'ö', 'ş', 'ü']);

/** Invisible characters used for evasion — removed outright (ZWSP, ZWNJ, ZWJ, BOM, soft hyphen). */
const INVISIBLES = new Set([0x200b, 0x200c, 0x200d, 0xfeff, 0x00ad].map((c) => String.fromCharCode(c)));

const LETTER_RE = /\p{L}/u;
const DIGIT_RE = /\p{N}/u;
const COMBINING_MARK_RE = /\p{M}/gu;

function isLetter(ch: string): boolean {
  return LETTER_RE.test(ch);
}

/** Letter for matching purposes: real letters plus leet substitutes. */
function isPseudoLetter(ch: string): boolean {
  return isLetter(ch) || ch in LEET_MAP;
}

/** Word character for boundary decisions (conservative: letters + digits). */
function isWordChar(ch: string): boolean {
  return LETTER_RE.test(ch) || DIGIT_RE.test(ch);
}

/** Strip combining marks unless the character is a Turkish letter proper. */
function foldDiacritics(ch: string): string {
  if (TURKISH_LETTERS.has(ch)) return ch;
  return ch.normalize('NFD').replace(COMBINING_MARK_RE, '').normalize('NFC');
}

interface NormChar {
  ch: string;
  /** UTF-16 index of the originating character in the source string. */
  idx: number;
}

/**
 * Remove separator characters inside runs of SINGLE pseudo-letters
 * ("k.u.f.u.r", "k u f u r" -> "kufur") without merging ordinary words
 * ("kotu soz" stays two words: its segments are multi-letter). A run needs
 * at least 3 letters, each separated by 1-2 non-alphanumeric characters.
 * Leet symbol keys (@, $, +, ...) are treated as letters, never separators.
 */
function stripLetterSeparators(chars: NormChar[]): NormChar[] {
  // Project every char to a class so a regex can find the pattern:
  // L = pseudo-letter, D = other digit, S = separator.
  const classes = chars
    .map((c) => (isPseudoLetter(c.ch) ? 'L' : DIGIT_RE.test(c.ch) ? 'D' : 'S'))
    .join('');
  const runRe = /(?<![LD])L(?:S{1,2}L){2,}(?![LD])/g;
  const drop = new Set<number>();
  for (const m of classes.matchAll(runRe)) {
    const start = m.index ?? 0;
    for (let k = start; k < start + m[0].length; k++) {
      if (classes[k] === 'S') drop.add(k);
    }
  }
  return drop.size === 0 ? chars : chars.filter((_, k) => !drop.has(k));
}

/** Collapse character runs of length >= 3 to a single character (aaaa -> a, aa -> aa). */
function collapseRepeats(chars: NormChar[]): NormChar[] {
  const out: NormChar[] = [];
  let i = 0;
  while (i < chars.length) {
    let end = i;
    while (end < chars.length && chars[end].ch === chars[i].ch) end++;
    const keep = end - i >= 3 ? 1 : end - i;
    for (let k = 0; k < keep; k++) out.push(chars[i + k]);
    i = end;
  }
  return out;
}

interface Normalized {
  text: string;
  /** map[i] = index in the original string of normalized char i. */
  map: number[];
}

/**
 * Full normalization pipeline with an index map back to the original
 * string (best effort — every normalized char remembers which original
 * character produced it).
 *
 * Order matters: separators are stripped BEFORE the leet map runs so that
 * "k.0.t.u" first joins to "k0tu" (leet digits count as letters for the
 * run detection) and only then becomes "kotu". Known limitation: a leet
 * symbol used as a separator ("k+u+f") is read as a substitution, not a
 * separator — accepted v0 tradeoff, '.'/space are the common evasions.
 */
export function normalizeTurkishWithMap(text: string): Normalized {
  // 1) Per code point: drop invisibles, lowercase with the Turkish locale
  //    (İ -> i, I -> ı — plain toLowerCase() is wrong for Turkish, see
  //    CLAUDE.md product rules).
  let chars: NormChar[] = [];
  let offset = 0;
  for (const cp of text) {
    const idx = offset;
    offset += cp.length;
    if (INVISIBLES.has(cp)) continue;
    for (const lc of cp.toLocaleLowerCase('tr-TR')) {
      chars.push({ ch: lc, idx });
    }
  }

  // 2) Separator-evasion stripping (single-letter runs).
  chars = stripLetterSeparators(chars);

  // 3) Leet substitution + foreign diacritic folding.
  const folded: NormChar[] = [];
  for (const { ch, idx } of chars) {
    const substituted = LEET_MAP[ch] ?? ch;
    for (const f of foldDiacritics(substituted)) {
      folded.push({ ch: f, idx });
    }
  }

  // 4) Repeated-character collapsing.
  const collapsed = collapseRepeats(folded);

  return {
    text: collapsed.map((c) => c.ch).join(''),
    map: collapsed.map((c) => c.idx),
  };
}

/** Normalize a Turkish chat message for matching. See normalizeTurkishWithMap. */
export function normalizeTurkish(text: string): string {
  return normalizeTurkishWithMap(text).text;
}

interface ListEntry {
  /** The entry exactly as configured (reported back in matches). */
  original: string;
  /** Normalized form actually used for matching. */
  norm: string;
}

interface Span {
  start: number;
  /** Exclusive. */
  end: number;
}

function compileList(words: string[] | undefined): ListEntry[] {
  const out: ListEntry[] = [];
  const seen = new Set<string>();
  for (const original of words ?? []) {
    const norm = normalizeTurkish(original).trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push({ original, norm });
  }
  return out;
}

/** All occurrences of `needle` in `haystack`; optionally word-boundary strict. */
function findOccurrences(haystack: string, needle: string, wordBoundary: boolean): number[] {
  const hits: number[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    from = at + 1;
    if (wordBoundary) {
      const before = at > 0 ? haystack[at - 1] : '';
      const after = at + needle.length < haystack.length ? haystack[at + needle.length] : '';
      if ((before && isWordChar(before)) || (after && isWordChar(after))) continue;
    }
    hits.push(at);
  }
  return hits;
}

/**
 * Turkish profanity/toxicity filter over runtime-configured word lists.
 * Stateless per message; repeat-offender state is the caller's business
 * (v0: pass the prior offense count into suggestAction).
 */
export class DilBekcisi {
  private readonly soft: ListEntry[];
  private readonly hard: ListEntry[];
  private readonly whitelist: ListEntry[];
  private readonly thresholds: ActionThresholds;

  constructor(config: DilBekcisiConfig) {
    this.soft = compileList(config.softList);
    this.hard = compileList(config.hardList);
    this.whitelist = compileList(config.whitelist);
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  }

  check(message: string): DilBekcisiResult {
    const { text, map } = normalizeTurkishWithMap(message);
    const protectedSpans = this.whitelistSpans(text);
    const inProtected = (start: number, len: number): boolean =>
      protectedSpans.some((s) => s.start <= start && start + len <= s.end);

    const matches: Array<DilBekcisiMatch & { normIndex: number }> = [];
    let hardHit = false;
    let softHit = false;

    // Hard terms: substring match (catches agglutinated forms).
    for (const entry of this.hard) {
      for (const at of findOccurrences(text, entry.norm, false)) {
        if (inProtected(at, entry.norm.length)) continue;
        hardHit = true;
        matches.push({ word: entry.original, index: map[at] ?? 0, normIndex: at });
      }
    }

    // Soft terms: standalone words only (Scunthorpe guard #1).
    for (const entry of this.soft) {
      for (const at of findOccurrences(text, entry.norm, true)) {
        if (inProtected(at, entry.norm.length)) continue;
        softHit = true;
        matches.push({ word: entry.original, index: map[at] ?? 0, normIndex: at });
      }
    }

    matches.sort((a, b) => a.normIndex - b.normIndex);
    return {
      verdict: hardHit ? 'hard' : softHit ? 'soft' : 'clean',
      matches: matches.map(({ word, index }) => ({ word, index })),
    };
  }

  /**
   * Map a verdict to a moderation action suggestion (never auto-executed —
   * the mod stays in the loop, see research doc on false-positive cost).
   *
   * @param repeatCount number of PRIOR offenses recorded for this user
   *                    (0 = first offense). v0 is stateless by design; the
   *                    caller owns per-user counting.
   */
  suggestAction(verdict: Verdict, repeatCount = 0): SuggestedAction {
    const offense = repeatCount + 1;
    switch (verdict) {
      case 'clean':
        return 'none';
      case 'soft':
        if (offense >= this.thresholds.softTimeoutAfter) return 'delete+timeout';
        if (offense >= this.thresholds.softDeleteAfter) return 'delete';
        return 'flag';
      case 'hard':
        return offense >= this.thresholds.hardTimeoutAfter ? 'delete+timeout' : 'delete';
    }
  }

  /**
   * Whitelist occurrence spans in the normalized text. Leading boundary is
   * required; the span then extends over any trailing word characters so a
   * whitelisted stem also covers its Turkish suffixed forms.
   */
  private whitelistSpans(text: string): Span[] {
    const spans: Span[] = [];
    for (const entry of this.whitelist) {
      let from = 0;
      while (from <= text.length - entry.norm.length) {
        const at = text.indexOf(entry.norm, from);
        if (at === -1) break;
        from = at + 1;
        if (at > 0 && isWordChar(text[at - 1])) continue; // mid-word: not this stem
        let end = at + entry.norm.length;
        while (end < text.length && isWordChar(text[end])) end++;
        spans.push({ start: at, end });
      }
    }
    return spans;
  }
}
