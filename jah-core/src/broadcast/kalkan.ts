import type { EngineAdapter, Unsubscribe } from '../engine/types.js';
import type { BroadcastModeService } from './mode.js';

export interface KalkanHotkeys {
  sesKalkani: string;
  sahneKalkani: string;
}

/**
 * "Kalkan" — layered panic system on true global hotkeys (P0 #16).
 *
 * - Ses Kalkanı: instantly MUTES every audible tab (DMCA / sudden-audio
 *   panic) — and keeps muting tabs that start playing while active, because
 *   the point of a panic is systemic silence. Release unmutes only what
 *   Kalkan itself muted, so user volume levels survive untouched.
 * - Sahne Kalkanı: force-enables Yayın Modu (privacy package).
 *
 * Works while the browser is unfocused — that is the whole point, and the
 * reason this cannot be replicated by a chrome.commands extension.
 * Defaults use the Ctrl+Shift family; Ctrl+Alt is FORBIDDEN (AltGr collision
 * on TR-Q/TR-F keyboards, see yayinci-modu-spec).
 */
export class KalkanService {
  private mutedByKalkan = new Set<string>();
  private sesActive = false;
  private transitioning = false;
  private hotkeyUnsubs: Unsubscribe[] = [];
  private tabSubs: Unsubscribe[] = [];
  private listeners = new Set<(state: { sesActive: boolean }) => void>();

  constructor(
    private readonly engine: EngineAdapter,
    private readonly broadcast: BroadcastModeService,
  ) {}

  /** Idempotent: re-registering disposes previous bindings first. */
  async registerHotkeys(
    keys: KalkanHotkeys = { sesKalkani: 'Ctrl+Shift+F9', sahneKalkani: 'Ctrl+Shift+F10' },
  ): Promise<void> {
    this.disposeHotkeys();
    this.hotkeyUnsubs.push(
      await this.engine.hotkeys.register(keys.sesKalkani, () => {
        void this.toggleSesKalkani().catch(() => this.notifyFailure('Ses Kalkanı'));
      }),
      await this.engine.hotkeys.register(keys.sahneKalkani, () => {
        void this.broadcast.enable().catch(() => this.notifyFailure('Sahne Kalkanı'));
      }),
    );
  }

  async toggleSesKalkani(): Promise<boolean> {
    // A second hotkey press mid-transition must not double-engage.
    if (this.transitioning) return this.sesActive;
    this.transitioning = true;
    try {
      if (this.sesActive) await this.releaseSesKalkani();
      else await this.engageSesKalkani();
    } finally {
      this.transitioning = false;
    }
    return this.sesActive;
  }

  async engageSesKalkani(): Promise<void> {
    if (this.sesActive) return;
    const tabs = await this.engine.tabs.list();
    for (const tab of tabs) {
      if (tab.audible && !tab.muted) {
        try {
          await this.engine.tabs.setMuted(tab.id, true);
          this.mutedByKalkan.add(tab.id);
        } catch {
          // tab died mid-panic — nothing to mute
        }
      }
    }
    // Systemic silence: tabs that START playing during the panic get muted too.
    this.tabSubs.push(
      this.engine.tabs.onUpdated((tab) => {
        if (this.sesActive && tab.audible && !tab.muted && !this.mutedByKalkan.has(tab.id)) {
          this.mutedByKalkan.add(tab.id);
          void this.engine.tabs.setMuted(tab.id, true).catch(() => this.mutedByKalkan.delete(tab.id));
        }
      }),
      this.engine.tabs.onClosed((tabId) => this.mutedByKalkan.delete(tabId)),
    );
    this.sesActive = true;
    this.emit();
  }

  async releaseSesKalkani(): Promise<void> {
    if (!this.sesActive) return;
    for (const tabId of this.mutedByKalkan) {
      try {
        await this.engine.tabs.setMuted(tabId, false);
      } catch {
        // tab closed while muted — releasing the rest must continue
      }
    }
    this.mutedByKalkan.clear();
    for (const unsub of this.tabSubs) unsub();
    this.tabSubs = [];
    this.sesActive = false;
    this.emit();
  }

  isSesKalkaniActive(): boolean {
    return this.sesActive;
  }

  onChange(cb: (state: { sesActive: boolean }) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  dispose(): void {
    this.disposeHotkeys();
    for (const unsub of this.tabSubs) unsub();
    this.tabSubs = [];
  }

  private disposeHotkeys(): void {
    for (const unsub of this.hotkeyUnsubs) unsub();
    this.hotkeyUnsubs = [];
  }

  /** A panic button that fails silently is worse than none — tell the streamer. */
  private notifyFailure(what: string): void {
    void this.engine.notifications
      .show({ title: `${what} çalıştırılamadı`, body: 'Tekrar deneyin veya ayarlardan kısayolu kontrol edin.' })
      .catch(() => {});
  }

  private emit(): void {
    for (const cb of this.listeners) cb({ sesActive: this.sesActive });
  }
}
