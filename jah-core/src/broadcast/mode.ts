import type { EngineAdapter, Unsubscribe } from '../engine/types.js';

/**
 * "Yayın Modu" orchestrator (P0 #9 full package, v0 core).
 *
 * Enabling broadcast mode flips the engine-level privacy switch
 * (autofill/history/bookmark surfaces hidden, generic tab titles,
 * notification queueing, ON AIR indicator — enforced by the engine adapter).
 * Richer product behaviors subscribe to onChange.
 *
 * OBS auto-trigger: the obs-websocket client (Faz 1) calls
 * handleObsStreamState() so the browser turns into the cockpit the moment
 * OBS starts streaming — no manual step for the streamer.
 */
export class BroadcastModeService {
  private on = false;
  private autoFollowObs = true;
  private listeners = new Set<(on: boolean) => void>();
  private captureSub: Unsubscribe | null = null;

  constructor(private readonly engine: EngineAdapter) {}

  /**
   * Hydrate from the engine (startup restore) and track engine-initiated
   * changes so this service never disagrees with the actual engine state.
   */
  async init(): Promise<void> {
    this.on = await this.engine.capture.isBroadcastMode();
    this.captureSub ??= this.engine.capture.onChanged((on) => {
      if (on !== this.on) {
        this.on = on;
        this.emit();
      }
    });
  }

  async enable(): Promise<void> {
    await this.set(true);
  }

  async disable(): Promise<void> {
    await this.set(false);
  }

  async toggle(): Promise<boolean> {
    await this.set(!this.on);
    return this.on;
  }

  isOn(): boolean {
    return this.on;
  }

  /** When true (default), OBS stream start/stop drives broadcast mode. */
  setAutoFollowObs(value: boolean): void {
    this.autoFollowObs = value;
  }

  async handleObsStreamState(streaming: boolean): Promise<void> {
    if (this.autoFollowObs) await this.set(streaming);
  }

  onChange(cb: (on: boolean) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  dispose(): void {
    this.captureSub?.();
    this.captureSub = null;
  }

  /**
   * Engine call comes FIRST: if it throws, our state stays consistent with
   * reality and a retry is still possible (a stale `on=true` with the engine
   * actually off would leave the streamer unprotected while believing
   * otherwise — the worst failure mode).
   */
  private async set(on: boolean): Promise<void> {
    if (on === this.on) return;
    await this.engine.capture.setBroadcastMode(on);
    // onChanged may have applied it already (mock/engine sync callbacks).
    if (this.on !== on) {
      this.on = on;
      this.emit();
    }
  }

  private emit(): void {
    for (const cb of this.listeners) cb(this.on);
  }
}
