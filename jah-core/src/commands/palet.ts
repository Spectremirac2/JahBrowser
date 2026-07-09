import type { EngineAdapter, Unsubscribe } from '../engine/types.js';

/**
 * "Hızlı Palet" — data layer of the Ctrl+K command palette (P1).
 *
 * Pure ranking/matching logic plus MRU persistence through engine.storage.
 * No UI concerns here: the palette view consumes search()/execute() and
 * renders whatever this registry returns.
 */

export interface JahCommand {
  id: string;
  /** User-visible label — Turkish, per product language rules. */
  title: string;
  keywords?: string[];
  category?: string;
  run: () => void | Promise<void>;
  /** When present and returning false the command is hidden and not executable. */
  isAvailable?: () => boolean;
}

const MRU_STORAGE_KEY = 'palet:mru';
const MRU_MAX = 50;

/**
 * Turkish-aware lowercasing (İ→i, I→ı). Local on purpose: importing from
 * moderation/ would couple unrelated modules for one line of code.
 */
function trLower(s: string): string {
  return s.toLocaleLowerCase('tr-TR');
}

/** Match quality buckets — lower is better. */
const enum MatchRank {
  TitlePrefix = 0,
  TitleWordStart = 1,
  TitleSubstring = 2,
  Keyword = 3,
}

function rankOf(cmd: JahCommand, query: string): MatchRank | undefined {
  const title = trLower(cmd.title);
  if (title.startsWith(query)) return MatchRank.TitlePrefix;
  if (title.split(/\s+/).some((word) => word.startsWith(query))) return MatchRank.TitleWordStart;
  if (title.includes(query)) return MatchRank.TitleSubstring;
  if (cmd.keywords?.some((k) => trLower(k).includes(query))) return MatchRank.Keyword;
  return undefined;
}

export class CommandRegistry {
  private readonly commands = new Map<string, JahCommand>();
  /** Registration order — the stable tiebreaker for equal-rank results. */
  private readonly insertionIndex = new Map<string, number>();
  private nextInsertion = 0;
  /** Most-recent-first command ids; hydrated by init(), persisted on execute(). */
  private mru: string[] = [];

  constructor(private readonly engine: EngineAdapter) {}

  /** Load the persisted MRU list. Call once before first search(). */
  async init(): Promise<void> {
    const stored = await this.engine.storage.get<unknown>(MRU_STORAGE_KEY);
    if (Array.isArray(stored)) {
      this.mru = stored.filter((id): id is string => typeof id === 'string').slice(0, MRU_MAX);
    }
  }

  register(cmd: JahCommand): Unsubscribe {
    if (this.commands.has(cmd.id)) {
      throw new Error(`command already registered: ${cmd.id}`);
    }
    this.commands.set(cmd.id, cmd);
    this.insertionIndex.set(cmd.id, this.nextInsertion++);
    return () => {
      // Guard against a stale unsubscribe deleting a newer re-registration.
      if (this.commands.get(cmd.id) === cmd) {
        this.commands.delete(cmd.id);
        this.insertionIndex.delete(cmd.id);
      }
    };
  }

  /**
   * Ranked search over available commands (tr-TR case folding, so "izle"
   * finds "İzlemeye Geç"). Rank order: exact title prefix > word-start match
   * in title > substring in title > keyword match. Ties break by MRU
   * recency, then registration order — fully deterministic. Empty/blank
   * query lists MRU commands first, then the rest sorted by title.
   */
  search(query: string): JahCommand[] {
    const q = trLower(query.trim());
    const available = [...this.commands.values()].filter((c) => c.isAvailable?.() !== false);

    if (q === '') {
      const mruIds = this.mru.filter((id) => available.some((c) => c.id === id));
      const recent = mruIds.map((id) => this.commands.get(id) as JahCommand);
      const rest = available
        .filter((c) => !mruIds.includes(c.id))
        .sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'));
      return [...recent, ...rest];
    }

    return available
      .map((cmd) => ({ cmd, rank: rankOf(cmd, q) }))
      .filter((entry): entry is { cmd: JahCommand; rank: MatchRank } => entry.rank !== undefined)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        const mruA = this.mruPosition(a.cmd.id);
        const mruB = this.mruPosition(b.cmd.id);
        if (mruA !== mruB) return mruA - mruB;
        return (this.insertionIndex.get(a.cmd.id) ?? 0) - (this.insertionIndex.get(b.cmd.id) ?? 0);
      })
      .map((entry) => entry.cmd);
  }

  /**
   * Run a command and move it to the front of the MRU list (only on
   * success — a command that threw should not gain recency). The MRU list
   * is capped at 50 and persisted to engine.storage under "palet:mru".
   */
  async execute(id: string): Promise<void> {
    const cmd = this.commands.get(id);
    if (!cmd) throw new Error(`no such command: ${id}`);
    if (cmd.isAvailable?.() === false) throw new Error(`command not available: ${id}`);
    await cmd.run();
    this.mru = [id, ...this.mru.filter((other) => other !== id)].slice(0, MRU_MAX);
    await this.engine.storage.set(MRU_STORAGE_KEY, this.mru);
  }

  private mruPosition(id: string): number {
    const idx = this.mru.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  }
}
