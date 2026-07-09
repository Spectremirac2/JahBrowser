import type { EngineAdapter, Unsubscribe } from '../engine/types.js';
import type { ObsStreamStatus } from '../obs/client.js';

/**
 * "Nabız" — stream health monitor (P0, yayin-sagligi.md).
 *
 * The painful truth of streaming health: the streamer's own screen looks
 * perfect while viewers see freezes — the only sensor is chat saying
 * "donuyor". OBS produces the data every second (GetStreamStatus:
 * skipped-frame counters, congestion, reconnect flag); it is just trapped in
 * a window behind the game. Nabız polls it, derives a skipped-frame RATE
 * from counter deltas and boils everything down to one traffic-light state
 * the browser can surface anywhere ("chat söylemeden önce tarayıcı söyler").
 *
 * States:
 * - "iyi"      — skip rate at/below warn threshold, stream up.
 * - "uyari"    — skip rate above warnThreshold (default 2%).
 * - "kritik"   — skip rate above critThreshold (default 10%) OR OBS is in a
 *                reconnect loop (the single most urgent signal there is).
 * - "veri-yok" — OBS unreachable or not streaming: nothing to diagnose.
 *
 * Flapping guard: a raw reading must persist `debouncePolls` consecutive
 * polls (default 2) before the public state changes — one congested sample
 * must not fire a red alert. Notifications fire only on transitions INTO
 * uyari/kritik, never repeatedly while a state persists.
 */

export type NabizState = 'iyi' | 'uyari' | 'kritik' | 'veri-yok';

/**
 * Structural OBS surface (satisfied by ObsWebSocketClient) so tests and
 * alternative sources can inject fakes without a websocket.
 */
export interface NabizObsSource {
  getStreamStatus(): Promise<ObsStreamStatus>;
  /** Fires true/false on terminal OBS stream output start/stop. */
  onStreamStateChanged(cb: (active: boolean) => void): Unsubscribe;
}

export interface NabizOptions {
  /** Poll cadence; research recommends 1-2 s against a local OBS. */
  intervalMs?: number;
  /** Skip-rate fraction above which state becomes "uyari". */
  warnThreshold?: number;
  /** Skip-rate fraction above which state becomes "kritik". */
  critThreshold?: number;
  /** Consecutive polls a raw state must persist before committing. */
  debouncePolls?: number;
}

export interface NabizSample {
  /** Raw OBS status the sample was derived from. */
  status: ObsStreamStatus;
  /**
   * Fraction (0..1) of output frames skipped since the PREVIOUS sample —
   * the network-drop rate. 0 when there is no baseline yet (first sample of
   * a stream) or when the counters reset (new stream started).
   */
  skipRate: number;
}

export class NabizService {
  private state: NabizState = 'veri-yok';
  private pendingState: NabizState | null = null;
  private pendingCount = 0;
  private lastSample: NabizSample | undefined;
  /** Frame-counter baseline of the previous poll; null = no delta possible. */
  private baseline: { skipped: number; total: number } | null = null;
  private listeners = new Set<(state: NabizState) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private obsSub: Unsubscribe | null = null;
  private polling = false;

  private readonly intervalMs: number;
  private readonly warnThreshold: number;
  private readonly critThreshold: number;
  private readonly debouncePolls: number;

  constructor(
    private readonly engine: EngineAdapter,
    private readonly obs: NabizObsSource,
    opts: NabizOptions = {},
  ) {
    this.intervalMs = opts.intervalMs ?? 2_000;
    this.warnThreshold = opts.warnThreshold ?? 0.02;
    this.critThreshold = opts.critThreshold ?? 0.1;
    this.debouncePolls = opts.debouncePolls ?? 2;
  }

  /** Idempotent: subscribes to OBS push events + starts the poll loop. */
  start(): void {
    if (this.timer) return;
    this.obsSub = this.obs.onStreamStateChanged((active) => this.handleStreamState(active));
    this.timer = setInterval(() => void this.pollNow(), this.intervalMs);
    void this.pollNow();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.obsSub?.();
    this.obsSub = null;
  }

  getState(): NabizState {
    return this.state;
  }

  /** Last successfully polled sample; undefined until the first good poll. */
  getLastSample(): NabizSample | undefined {
    return this.lastSample;
  }

  /** Fires AFTER debounce, once per committed transition. */
  onStateChange(cb: (state: NabizState) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Single poll cycle; public so tests and manual refresh can drive it
   * without timers. Overlapping calls are coalesced.
   */
  async pollNow(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      let status: ObsStreamStatus;
      try {
        status = await this.obs.getStreamStatus();
      } catch {
        // OBS unreachable / not identified — no data, no diagnosis.
        this.baseline = null;
        this.observe('veri-yok');
        return;
      }
      if (!status.outputActive) {
        // Not streaming: frame counters are meaningless and will reset.
        this.baseline = null;
        this.observe('veri-yok');
        return;
      }
      const skipRate = this.computeSkipRate(status);
      this.lastSample = { status, skipRate };
      this.observe(this.classify(status, skipRate));
    } finally {
      this.polling = false;
    }
  }

  /**
   * Push signal from OBS (terminal start/stop only). Stop is definitive —
   * no debounce needed, this is not a flappy metric. Start just resets the
   * frame baseline: a new stream restarts the counters from zero.
   */
  private handleStreamState(active: boolean): void {
    this.baseline = null;
    this.pendingState = null;
    this.pendingCount = 0;
    if (!active) this.commit('veri-yok');
  }

  private classify(status: ObsStreamStatus, skipRate: number): NabizState {
    // Reconnect loop is THE most urgent signal (yayin-sagligi.md): the
    // stream is down for viewers right now, whatever the counters say.
    if (status.outputReconnecting) return 'kritik';
    if (skipRate > this.critThreshold) return 'kritik';
    if (skipRate > this.warnThreshold) return 'uyari';
    return 'iyi';
  }

  /**
   * Skipped-frame rate from counter deltas between polls. Absolute counters
   * are useless (a 6-hour stream accumulates drops forever); only the delta
   * says what is happening NOW.
   */
  private computeSkipRate(status: ObsStreamStatus): number {
    const prev = this.baseline;
    this.baseline = { skipped: status.outputSkippedFrames, total: status.outputTotalFrames };
    // No baseline, or counters went backwards (OBS restarted the stream
    // between polls): start fresh instead of producing a bogus rate.
    if (!prev || status.outputTotalFrames < prev.total || status.outputSkippedFrames < prev.skipped) {
      return 0;
    }
    const deltaTotal = status.outputTotalFrames - prev.total;
    if (deltaTotal <= 0) return 0;
    return (status.outputSkippedFrames - prev.skipped) / deltaTotal;
  }

  /** Debounce: commit only after `debouncePolls` consecutive identical readings. */
  private observe(raw: NabizState): void {
    if (raw === this.state) {
      this.pendingState = null;
      this.pendingCount = 0;
      return;
    }
    if (this.pendingState === raw) {
      this.pendingCount += 1;
    } else {
      this.pendingState = raw;
      this.pendingCount = 1;
    }
    if (this.pendingCount >= this.debouncePolls) this.commit(raw);
  }

  private commit(next: NabizState): void {
    if (next === this.state) return;
    this.state = next;
    this.pendingState = null;
    this.pendingCount = 0;
    for (const cb of this.listeners) cb(next);
    // Transition-only diagnosis toast — never re-fired while a state persists.
    if (next === 'uyari' || next === 'kritik') this.notifyDiagnosis(next);
  }

  /**
   * Turkish diagnosis, not raw numbers (yayin-sagligi.md P1 "akıllı tanı
   * mesajları"): tell the streamer what to DO while the game covers OBS.
   */
  private notifyDiagnosis(state: 'uyari' | 'kritik'): void {
    const reconnecting = this.lastSample?.status.outputReconnecting === true;
    let title: string;
    let body: string;
    if (state === 'kritik' && reconnecting) {
      title = 'Yayın sağlığı: KOPTU';
      body = 'OBS yeniden bağlanmaya çalışıyor — izleyiciler şu an donuk ekran görüyor. İnterneti kontrol et.';
    } else if (state === 'kritik') {
      title = 'Yayın sağlığı: kritik';
      body = 'Ciddi kare kaybı var — izleyicide donma yaşanıyor. Bitrate düşürmeyi veya interneti kontrol etmeyi dene.';
    } else {
      title = 'Yayın sağlığı: uyarı';
      body = 'Kareler düşüyor — bitrate/internet kontrol et. Chat söylemeden önce müdahale edebilirsin.';
    }
    void this.engine.notifications.show({ title, body }).catch(() => {
      // A missed toast must not break the poll loop.
    });
  }
}
