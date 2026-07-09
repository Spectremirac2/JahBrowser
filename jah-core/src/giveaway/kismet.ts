import type { Unsubscribe } from '../engine/types.js';
import type { KickChatMessage } from '../platform/kick/types.js';

/**
 * "Kısmet" — chat-listening giveaway core (P1 #15, yayinci-modu-spec §2.G).
 *
 * Design background: research/10-yayinci-derinlesme/izleyici-etkilesim.md.
 * Kick has NO built-in giveaway; streamers juggle BotRix's multi-step web
 * flow plus a wheel site with hand-pasted participant lists. Because the
 * browser already sits inside the chat, Kısmet counts participants live from
 * the keyword (e.g. "!katıl"), applies role-based luck multipliers (subluck —
 * the Mo'Kick feature with no platform equivalent), and hands the pool to
 * the Kısmet wheel / OBS overlay via getSnapshot().
 *
 * This module is PURE LOGIC over KickChatMessage values — no engine, no
 * network, no DOM. Chat transport (official API / Pusher fallback) lives in
 * platform/kick; the UI simply pipes incoming messages into feed().
 *
 * Randomness: draws default to a crypto.getRandomValues-backed rng
 * (fairness requirement from the research doc — wheelofnames precedent);
 * tests inject a deterministic rng.
 */

export interface KismetEntry {
  /** Display name exactly as first seen in chat (identity is case-insensitive). */
  username: string;
  /** Draw weight >= 1 — highest matching subluck badge weight, otherwise 1. */
  weight: number;
}

export interface KismetOptions {
  /** Join keyword, e.g. "!katıl". Compared trimmed + tr-TR case-insensitive. */
  keyword: string;
  /**
   * Luck multipliers per badge slug (e.g. { subscriber: 2, og: 3 }).
   * A participant gets the HIGHEST weight among their matching badges;
   * everyone else gets 1. Weights <= 1 or non-finite are ignored — subluck
   * can only boost, never demote below the base chance.
   */
  subluck?: Record<string, number>;
  /**
   * v0 invariant: one entry per user, always. Typed `false` so callers
   * cannot pass `true` expecting repeat entries before that ships.
   */
  allowRepeatEntry?: false;
}

/** Feed of the OBS overlay / wheel / sidebar UI. */
export interface KismetSnapshot {
  running: boolean;
  /** Last started keyword ('' before the first start). */
  keyword: string;
  entries: KismetEntry[];
  winners: KismetEntry[];
}

/**
 * Default rng: crypto.getRandomValues when available (fair-draw requirement),
 * Math.random as a last-resort fallback for exotic runtimes.
 */
export function createCryptoRng(): () => number {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    return () => cryptoObj.getRandomValues(buf)[0] / 2 ** 32;
  }
  return Math.random;
}

export class KismetService {
  private running = false;
  private keyword = '';
  private normalizedKeyword = '';
  private subluck = new Map<string, number>();
  /** Key: tr-TR-lowercased username — enforces one entry per user. */
  private pool = new Map<string, KismetEntry>();
  private winnersList: KismetEntry[] = [];
  private entryListeners = new Set<(entry: KismetEntry) => void>();
  private winnerListeners = new Set<(winner: KismetEntry) => void>();

  /** @param rng uniform [0, 1) source — inject a stub for deterministic tests. */
  constructor(private readonly rng: () => number = createCryptoRng()) {}

  /**
   * Begin collecting entries. Starting again RESETS the previous round
   * (entries + winners) — each start is a fresh giveaway.
   */
  start(options: KismetOptions): void {
    const keyword = options.keyword.trim();
    if (keyword === '') {
      throw new Error('Kısmet: anahtar kelime boş olamaz.');
    }
    this.keyword = keyword;
    this.normalizedKeyword = keyword.toLocaleLowerCase('tr-TR');
    this.subluck.clear();
    for (const [slug, weight] of Object.entries(options.subluck ?? {})) {
      // Badge slugs are ASCII identifiers from the Kick API — plain
      // toLowerCase on purpose ('VIP' must match 'vip', not tr-TR 'vıp').
      if (Number.isFinite(weight) && weight > 1) this.subluck.set(slug.toLowerCase(), weight);
    }
    this.pool.clear();
    this.winnersList = [];
    this.running = true;
  }

  /**
   * Consider a chat message for entry. Returns the accepted entry, or
   * undefined when ignored (not running, keyword mismatch, duplicate user).
   *
   * Matching rule (documented choice): the trimmed, tr-TR-lowercased content
   * must EQUAL the keyword or START WITH the keyword followed by whitespace.
   * So "!KATIL" and "!katıl hediye" count, but "!katılmıyorum" does not —
   * plain startsWith would swallow such prefix words.
   *
   * One entry per user (username compared tr-TR case-insensitive); the first
   * entry wins, later messages from the same user change nothing.
   */
  feed(msg: KickChatMessage): KismetEntry | undefined {
    if (!this.running) return undefined;
    if (!this.matchesKeyword(msg.content)) return undefined;
    const username = msg.senderUsername.trim();
    const key = username.toLocaleLowerCase('tr-TR');
    if (key === '' || this.pool.has(key)) return undefined;
    const entry: KismetEntry = { username, weight: this.weightFor(msg.badges) };
    this.pool.set(key, entry);
    for (const cb of this.entryListeners) cb(entry);
    return entry;
  }

  entries(): KismetEntry[] {
    return [...this.pool.values()].map((e) => ({ ...e }));
  }

  get entryCount(): number {
    return this.pool.size;
  }

  /**
   * Weighted random draw WITHOUT replacement: each winner leaves the pool,
   * so nobody wins twice — a reroll is simply another drawWinners() call.
   * Drawing more than the pool holds returns everyone left. Winners
   * accumulate in the snapshot until the next start().
   */
  drawWinners(count = 1): KismetEntry[] {
    const drawn: KismetEntry[] = [];
    const candidates = [...this.pool.entries()];
    while (drawn.length < count && candidates.length > 0) {
      let total = 0;
      for (const [, entry] of candidates) total += entry.weight;
      let r = this.rng() * total;
      // Walk cumulative weights; fall back to the last slot so a float edge
      // (rng ~1) can never walk off the end.
      let index = candidates.length - 1;
      for (let i = 0; i < candidates.length; i++) {
        r -= candidates[i][1].weight;
        if (r < 0) {
          index = i;
          break;
        }
      }
      const [key, winner] = candidates.splice(index, 1)[0];
      this.pool.delete(key);
      this.winnersList.push(winner);
      drawn.push(winner);
      for (const cb of this.winnerListeners) cb(winner);
    }
    return drawn;
  }

  /** Stop collecting (draws stay possible) and return the final snapshot. */
  end(): KismetSnapshot {
    this.running = false;
    return this.getSnapshot();
  }

  getSnapshot(): KismetSnapshot {
    return {
      running: this.running,
      keyword: this.keyword,
      entries: this.entries(),
      winners: this.winnersList.map((w) => ({ ...w })),
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  onEntry(cb: (entry: KismetEntry) => void): Unsubscribe {
    this.entryListeners.add(cb);
    return () => this.entryListeners.delete(cb);
  }

  onWinner(cb: (winner: KismetEntry) => void): Unsubscribe {
    this.winnerListeners.add(cb);
    return () => this.winnerListeners.delete(cb);
  }

  dispose(): void {
    this.running = false;
    this.pool.clear();
    this.winnersList = [];
    this.entryListeners.clear();
    this.winnerListeners.clear();
  }

  private matchesKeyword(content: string): boolean {
    const text = content.trim().toLocaleLowerCase('tr-TR');
    if (text === this.normalizedKeyword) return true;
    if (!text.startsWith(this.normalizedKeyword)) return false;
    return /\s/.test(text.charAt(this.normalizedKeyword.length));
  }

  private weightFor(badges: string[]): number {
    let weight = 1;
    for (const badge of badges) {
      const candidate = this.subluck.get(badge.toLowerCase());
      if (candidate !== undefined && candidate > weight) weight = candidate;
    }
    return weight;
  }
}
