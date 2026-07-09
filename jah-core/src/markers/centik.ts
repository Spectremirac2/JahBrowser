import type { EngineAdapter, Unsubscribe } from '../engine/types.js';

export interface Centik {
  id: string;
  /** Wall-clock time, ISO 8601. */
  at: string;
  /** Seconds since stream start; null when no session is active. */
  elapsedSec: number | null;
  note?: string;
}

interface CentikSessionState {
  sessionStartIso: string | null;
  nextId: number;
  markers: Centik[];
}

const CURRENT_KEY = 'centik:current-session';
const LAST_KEY = 'centik:last-session';

/**
 * "Çentik" — global moment-marking during a live stream (P0 #17).
 *
 * The streamer hits one global hotkey mid-game ("bu an kesitlik!") and gets a
 * timestamped marker without touching the browser. After the stream, the
 * marker list exports as VOD deep links, YouTube chapter lines, CSV or JSON —
 * feeding the kesit/clip economy that Jahrein's community runs on.
 * Serverless and API-free by design: everything is local. The session is
 * persisted continuously so a mid-stream crash loses nothing.
 */
export class CentikService {
  private markers: Centik[] = [];
  private sessionStart: Date | null = null;
  private nextId = 1;
  private hotkeyUnsub: Unsubscribe | null = null;

  constructor(
    private readonly engine: EngineAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Crash recovery: restore an interrupted session from disk.
   * Returns true when a previous session was found and loaded.
   */
  async restore(): Promise<boolean> {
    const state = await this.engine.storage.get<CentikSessionState>(CURRENT_KEY);
    if (!state) return false;
    this.markers = state.markers;
    this.nextId = state.nextId;
    this.sessionStart = state.sessionStartIso ? new Date(state.sessionStartIso) : null;
    return true;
  }

  /** Start a marking session; pass the real stream start for accurate offsets. */
  async startSession(streamStartedAt?: Date): Promise<void> {
    // Never silently destroy an unfinished session (crash + restart path).
    const existing = await this.engine.storage.get<CentikSessionState>(CURRENT_KEY);
    if (existing && existing.markers.length) {
      await this.engine.storage.set(LAST_KEY, existing);
    }
    this.sessionStart = streamStartedAt ?? this.now();
    this.markers = [];
    this.nextId = 1;
    await this.persist();
  }

  /** Idempotent: re-registering (e.g. shortcut changed in settings) unbinds the old key. */
  async registerHotkey(accelerator = 'Ctrl+Shift+F8'): Promise<void> {
    this.hotkeyUnsub?.();
    this.hotkeyUnsub = null;
    this.hotkeyUnsub = await this.engine.hotkeys.register(accelerator, () => void this.add());
  }

  async add(note?: string): Promise<Centik> {
    const at = this.now();
    const elapsedSec = this.sessionStart
      ? Math.max(0, Math.floor((at.getTime() - this.sessionStart.getTime()) / 1000))
      : null;
    const marker: Centik = {
      id: String(this.nextId++),
      at: at.toISOString(),
      elapsedSec,
      ...(note !== undefined ? { note } : {}),
    };
    this.markers.push(marker);
    await this.persist();
    await this.engine.notifications.show({
      title: `Çentik atıldı${elapsedSec !== null ? ` (${formatClock(elapsedSec)})` : ''}`,
      body: note ?? '',
    });
    return marker;
  }

  list(): Centik[] {
    return [...this.markers];
  }

  exportJson(): string {
    return JSON.stringify(this.markers, null, 2);
  }

  exportCsv(): string {
    const rows = this.markers.map(
      (m) => `${m.id},${m.at},${m.elapsedSec ?? ''},"${(m.note ?? '').replaceAll('"', '""')}"`,
    );
    return ['id,at,elapsedSec,note', ...rows].join('\n');
  }

  /** VOD deep links using Twitch-style offsets (e.g. ?t=1h02m03s). */
  exportVodLinks(vodUrl: string): string[] {
    const sep = vodUrl.includes('?') ? '&' : '?';
    return this.markers
      .filter((m) => m.elapsedSec !== null)
      .map((m) => `${vodUrl}${sep}t=${formatVodOffset(m.elapsedSec as number)}`);
  }

  /** Archive to 'last-session' (post-stream export screen survives restarts). */
  async endSession(): Promise<Centik[]> {
    const finished = this.list();
    await this.engine.storage.set(LAST_KEY, this.snapshot());
    await this.engine.storage.delete(CURRENT_KEY);
    this.sessionStart = null;
    this.markers = [];
    this.nextId = 1;
    return finished;
  }

  async loadLastSession(): Promise<Centik[]> {
    const state = await this.engine.storage.get<CentikSessionState>(LAST_KEY);
    return state?.markers ?? [];
  }

  dispose(): void {
    this.hotkeyUnsub?.();
    this.hotkeyUnsub = null;
  }

  private snapshot(): CentikSessionState {
    return {
      sessionStartIso: this.sessionStart?.toISOString() ?? null,
      nextId: this.nextId,
      markers: this.markers,
    };
  }

  private async persist(): Promise<void> {
    await this.engine.storage.set(CURRENT_KEY, this.snapshot());
  }
}

function formatVodOffset(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
