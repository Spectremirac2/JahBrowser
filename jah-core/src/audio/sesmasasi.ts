import type { EngineAdapter, TabInfo, Unsubscribe } from '../engine/types.js';

/** Storage key for per-origin remembered volume levels. */
const ORIGINS_KEY = 'sesmasasi:origins';

/** Default duck target when an alert fires (research doc: alert ducking). */
const DEFAULT_DUCK_LEVEL = 0.2;

export interface SesMasasiState {
  /** Tab id currently soloed, or null. */
  solo: string | null;
  /** Whether alert ducking is currently engaged. */
  ducked: boolean;
}

export interface SetTabVolumeOptions {
  /**
   * Persist the level keyed by the tab's URL origin (engine.storage,
   * 'sesmasasi:origins') so new tabs / navigations to that origin get the
   * level re-applied automatically.
   */
  rememberOrigin?: boolean;
}

export interface DuckOptions {
  /** Tabs to leave at full tracked level — typically the alert-source tab. */
  exceptTabIds?: string[];
}

function clamp01(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(1, Math.max(0, level));
}

function originOf(url: string): string | undefined {
  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * "Ses Masası" — per-tab audio mixer (P1, research/10-yayinci-derinlesme/
 * muzik-ses-yonetimi.md): per-tab volume, solo, and alert ducking. No major
 * browser ships per-tab percentage volume; this service is the engine-agnostic
 * core of that gap-filler.
 *
 * DIVISION OF LABOR vs Kalkan: boolean mute (tabs.setMuted) is Kalkan's PANIC
 * primitive (Ses Kalkanı) and Ses Masası NEVER calls it — the mixer only
 * drives tabs.setAudioLevel, so the two systems cannot fight over tab state.
 * A tab can be both muted-by-Kalkan and have a mixer level; unmuting simply
 * resumes at the mixer's level.
 *
 * SOURCE OF TRUTH: the engine has no getAudioLevel (per-tab volume is
 * emulated, see engine/types.ts), so this service tracks the user's intended
 * ("tracked") level per tab and treats it as authoritative. Solo and duck
 * never overwrite tracked levels — they only change the EFFECTIVE level sent
 * to the engine:
 *
 *   effective(tab) = 0                       if solo active and tab != solo
 *                  = min(tracked, duckLevel) if ducked and tab not excepted
 *                  = tracked                 otherwise
 *
 * DUCK SEMANTICS (documented choice): effective = min(tracked, duckLevel)
 * rather than tracked * factor. Rationale: quiet tabs (already below the duck
 * target) stay untouched instead of dropping to near-silence, restore is
 * exact by construction (tracked never mutates), and repeated duck calls
 * cannot compound. duck() is idempotent; unduck() without duck is a no-op.
 *
 * SOLO + DUCK INTERPLAY: solo wins for the other tabs (they stay at 0);
 * the soloed tab itself is still subject to ducking unless listed in
 * exceptTabIds — an alert must be able to cut through even a soloed music tab.
 */
export class SesMasasiService {
  /** Tracked (user-intended) level per tab — the single source of truth. */
  private readonly levels = new Map<string, number>();
  /** Last URL origin seen per tab, to detect navigations in onUpdated. */
  private readonly lastOrigin = new Map<string, string | undefined>();
  /** Remembered per-origin levels, mirrored to engine.storage. */
  private origins: Record<string, number> = {};

  private soloTabId: string | null = null;
  /** Tabs this service zeroed for the current solo — restored on clearSolo. */
  private readonly soloTouched = new Set<string>();

  private duckState: { level: number; except: Set<string> } | null = null;
  /** Tabs this service ducked — restored on unduck. */
  private readonly duckTouched = new Set<string>();

  private subs: Unsubscribe[] = [];
  private readonly listeners = new Set<(state: SesMasasiState) => void>();
  private lastEmitted: SesMasasiState = { solo: null, ducked: false };

  constructor(private readonly engine: EngineAdapter) {}

  /**
   * Loads remembered origin levels from storage, subscribes to tab events,
   * and re-applies remembered levels to already-open tabs (startup restore).
   */
  async init(): Promise<void> {
    const stored = await this.engine.storage.get<Record<string, number>>(ORIGINS_KEY);
    this.origins = {};
    for (const [origin, level] of Object.entries(stored ?? {})) {
      if (typeof level === 'number') this.origins[origin] = clamp01(level);
    }
    this.subs.push(
      this.engine.tabs.onUpdated((tab) => {
        void this.handleTabUpdated(tab).catch(() => {});
      }),
      this.engine.tabs.onClosed((tabId) => {
        void this.handleTabClosed(tabId).catch(() => {});
      }),
    );
    for (const tab of await this.engine.tabs.list()) {
      await this.handleTabUpdated(tab);
    }
  }

  /**
   * Sets the tracked volume for a tab (clamped to 0..1) and pushes the
   * resulting effective level to the engine. If the engine call fails the
   * tracked level is rolled back so service state never lies about reality.
   */
  async setTabVolume(tabId: string, level: number, opts?: SetTabVolumeOptions): Promise<void> {
    const clamped = clamp01(level);
    const hadPrevious = this.levels.has(tabId);
    const previous = this.levels.get(tabId);
    this.levels.set(tabId, clamped);
    try {
      await this.applyTo(tabId, { rethrow: true });
    } catch (err) {
      if (hadPrevious && previous !== undefined) this.levels.set(tabId, previous);
      else this.levels.delete(tabId);
      throw err;
    }
    if (opts?.rememberOrigin) {
      const tab = (await this.engine.tabs.list()).find((t) => t.id === tabId);
      const origin = tab ? originOf(tab.url) : undefined;
      if (origin !== undefined) {
        this.origins[origin] = clamped;
        // Mark the origin as seen so a later non-navigation onUpdated does
        // not re-apply the remembered level over a manual tweak.
        this.lastOrigin.set(tabId, origin);
        await this.engine.storage.set(ORIGINS_KEY, { ...this.origins });
      }
    }
  }

  /** Tracked level for a tab; tabs never touched by the mixer default to 1. */
  getTabVolume(tabId: string): number {
    return this.levels.get(tabId) ?? 1;
  }

  /**
   * Solo a tab: every OTHER relevant tab (audible, or already tracked by the
   * mixer) is set to effective 0. Tracked levels are untouched, so clearSolo
   * restores exactly. Soloing a different tab switches the solo target.
   */
  async solo(tabId: string): Promise<void> {
    if (this.soloTabId === tabId) return;
    if (this.soloTabId !== null) await this.clearSolo();
    this.soloTabId = tabId;
    for (const tab of await this.listSafe()) {
      if (tab.id === tabId) continue;
      if (!tab.audible && !this.levels.has(tab.id)) continue;
      this.soloTouched.add(tab.id);
      await this.applyTo(tab.id);
    }
    this.emit();
  }

  /** Restores every tab zeroed by solo() back to its effective level. */
  async clearSolo(): Promise<void> {
    if (this.soloTabId === null) return;
    this.soloTabId = null;
    const touched = [...this.soloTouched];
    this.soloTouched.clear();
    for (const tabId of touched) {
      await this.applyTo(tabId);
    }
    this.emit();
  }

  /**
   * Alert ducking: caps every relevant tab (except exceptTabIds) at
   * min(tracked, level). Idempotent — calling again with the same arguments
   * performs no engine calls; calling with different arguments re-applies.
   */
  async duck(level: number = DEFAULT_DUCK_LEVEL, opts?: DuckOptions): Promise<void> {
    const clamped = clamp01(level);
    const except = new Set(opts?.exceptTabIds ?? []);
    if (this.duckState && this.duckState.level === clamped && sameSet(this.duckState.except, except)) {
      return;
    }
    this.duckState = { level: clamped, except };
    for (const tab of await this.listSafe()) {
      if (except.has(tab.id)) continue;
      if (!tab.audible && !this.levels.has(tab.id)) continue;
      this.duckTouched.add(tab.id);
      await this.applyTo(tab.id);
    }
    this.emit();
  }

  /** Restores every ducked tab to its effective level. No-op if not ducked. */
  async unduck(): Promise<void> {
    if (this.duckState === null) return;
    this.duckState = null;
    const touched = [...this.duckTouched];
    this.duckTouched.clear();
    for (const tabId of touched) {
      await this.applyTo(tabId);
    }
    this.emit();
  }

  getState(): SesMasasiState {
    return { solo: this.soloTabId, ducked: this.duckState !== null };
  }

  /** Fires whenever the solo/ducked tuple actually changes. */
  onChange(cb: (state: SesMasasiState) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Unsubscribes from all engine events. Deliberately does NOT touch volumes. */
  dispose(): void {
    for (const unsub of this.subs) unsub();
    this.subs = [];
    this.listeners.clear();
  }

  // --- internals ---

  private effectiveLevel(tabId: string): number {
    const tracked = this.levels.get(tabId) ?? 1;
    if (this.soloTabId !== null && tabId !== this.soloTabId) return 0;
    if (this.duckState !== null && !this.duckState.except.has(tabId)) {
      return Math.min(tracked, this.duckState.level);
    }
    return tracked;
  }

  private async applyTo(tabId: string, opts?: { rethrow?: boolean }): Promise<void> {
    try {
      await this.engine.tabs.setAudioLevel(tabId, this.effectiveLevel(tabId));
    } catch (err) {
      // Tab died mid-operation — the rest of the mixer must keep going.
      if (opts?.rethrow) throw err;
    }
  }

  private async handleTabUpdated(tab: TabInfo): Promise<void> {
    const origin = originOf(tab.url);
    const seenBefore = this.lastOrigin.has(tab.id);
    const last = this.lastOrigin.get(tab.id);
    if (seenBefore && origin === last) return; // not a navigation → never clobber manual levels
    this.lastOrigin.set(tab.id, origin);
    if (origin === undefined) return;
    const remembered = this.origins[origin];
    if (remembered === undefined) return;
    this.levels.set(tab.id, remembered);
    await this.applyTo(tab.id);
  }

  private async handleTabClosed(tabId: string): Promise<void> {
    this.levels.delete(tabId);
    this.lastOrigin.delete(tabId);
    this.soloTouched.delete(tabId);
    this.duckTouched.delete(tabId);
    if (this.soloTabId === tabId) {
      await this.clearSolo(); // soloed tab gone → the rest must come back
    }
  }

  private async listSafe(): Promise<TabInfo[]> {
    try {
      return await this.engine.tabs.list();
    } catch {
      return [];
    }
  }

  private emit(): void {
    const state = this.getState();
    if (state.solo === this.lastEmitted.solo && state.ducked === this.lastEmitted.ducked) return;
    this.lastEmitted = state;
    for (const cb of this.listeners) cb({ ...state });
  }
}
