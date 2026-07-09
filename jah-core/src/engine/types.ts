/**
 * Engine adapter contract — the ONLY surface jah-core is allowed to touch.
 *
 * Architectural rule (binding, see CLAUDE.md): product code never calls
 * Electron/Chromium APIs directly. Everything goes through this narrow
 * interface so the engine can be swapped (chromium-fork <-> electron)
 * without rewriting jah-core or the UI layer.
 */

export type EngineKind = 'chromium-fork' | 'electron' | 'mock';

export type Unsubscribe = () => void;

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
  audible: boolean;
  muted: boolean;
  pinned: boolean;
  /** Stream-aware memory rule: keep-alive tabs are never discarded/frozen. */
  streamKeepAlive: boolean;
}

export interface CreateTabOptions {
  url: string;
  active?: boolean;
  pinned?: boolean;
}

export interface TabManager {
  list(): Promise<TabInfo[]>;
  create(opts: CreateTabOptions): Promise<TabInfo>;
  close(tabId: string): Promise<void>;
  activate(tabId: string): Promise<void>;
  /** Core product promise: a live-stream tab is never put to sleep. */
  setStreamKeepAlive(tabId: string, keepAlive: boolean): Promise<void>;
  /**
   * Boolean mute — native 1:1 on both engines (WebContents.setAudioMuted /
   * tab muting). This is the panic primitive (Ses Kalkanı): unmuting
   * restores whatever volume the user had.
   */
  setMuted(tabId: string, muted: boolean): Promise<void>;
  /**
   * Per-tab volume 0..1 for the "Ses Masası" mixer (P1). CAPABILITY NOTE:
   * neither engine has a native per-tab volume API — real adapters emulate
   * it (audio stream interception on the fork, script injection on
   * Electron). Panic paths must use setMuted, never this.
   */
  setAudioLevel(tabId: string, level: number): Promise<void>;
  onUpdated(cb: (tab: TabInfo) => void): Unsubscribe;
  onClosed(cb: (tabId: string) => void): Unsubscribe;
}

export interface CompanionWindowOptions {
  width?: number;
  height?: number;
  alwaysOnTop?: boolean;
}

export interface WindowManager {
  /**
   * "Cep Yayın" primitive: reparent the ALREADY-PLAYING media/view of an
   * existing tab into a new always-on-top window (documentPictureInPicture
   * equivalent / WebContentsView reparenting). Never reloads the stream —
   * that would restart playback and re-trigger Kick's PiP block.
   */
  pipFromTab(tabId: string, opts?: CompanionWindowOptions): Promise<string>;
  /**
   * Open a jah-ui companion window (chat panel, kumanda, overlay config...).
   * The URL is a jah-core/UI view; composition (player+chat layout) is
   * product code, NOT the engine's business.
   */
  openCompanionWindow(viewUrl: string, opts?: CompanionWindowOptions): Promise<string>;
  closeWindow(windowId: string): Promise<void>;
  setAlwaysOnTop(windowId: string, onTop: boolean): Promise<void>;
  /**
   * Hide a window from screen capture (WDA_EXCLUDEFROMCAPTURE on Windows).
   * Foundation of "Hayalet Pencere" — visible to the streamer, invisible to OBS.
   */
  setExcludeFromCapture(windowId: string, exclude: boolean): Promise<void>;
}

/** Engine-neutral request shape — deliberately NOT DOM RequestInit. */
export interface JahRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Engine-neutral socket. On the Chromium fork this rides
 * //services/network, on Electron a ws client in the main process — jah-core
 * must not assume a DOM WebSocket exists in its execution context.
 */
export interface EngineSocket {
  send(data: string): void;
  close(): void;
  onOpen(cb: () => void): Unsubscribe;
  onMessage(cb: (data: string) => void): Unsubscribe;
  onClose(cb: () => void): Unsubscribe;
}

export interface NetworkBridge {
  fetchJson<T>(url: string, init?: JahRequestInit): Promise<T>;
  openSocket(url: string): Promise<EngineSocket>;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * OS-protected secret storage (Windows: DPAPI / Credential Manager).
 * Same shape as KeyValueStore but the engine MUST encrypt at rest and scope
 * to the OS user. Refresh tokens live here; access tokens stay in memory.
 */
export type SecureStore = KeyValueStore;

export interface NotificationOptions {
  title: string;
  body: string;
  onClickUrl?: string;
}

export interface NotificationPort {
  show(n: NotificationOptions): Promise<void>;
}

/**
 * True system-wide hotkeys (work while the browser is unfocused).
 * Foundation of "Kalkan" (panic layers) and "Çentik" (moment markers).
 * Accelerator format: "Ctrl+Shift+K" — Ctrl+Alt combos are FORBIDDEN
 * (AltGr collision on TR-Q/TR-F keyboards).
 *
 * CONTRACT: register MUST reject (throw) when the accelerator cannot be
 * bound (conflict with another app, invalid combo) so callers can surface
 * the failure — a silently dead panic button is worse than none.
 * TODO(faz-1): richer result type with conflict reason + alternative
 * suggestion, per urun-plani Faz 1 requirement.
 */
export interface GlobalHotkeyPort {
  register(accelerator: string, cb: () => void): Promise<Unsubscribe>;
}

/**
 * "Yayın Modu" switch. The engine enforces the privacy package
 * (autofill/history surfaces hidden, generic tab titles, notification
 * queueing, ON AIR indicator) atomically behind this single switch in v0.
 * TODO(faz-1): split into granular primitives (setGenericTabTitles,
 * setTabLock, setSensitiveInputMasking...) orchestrated by jah-core so the
 * package definition lives in exactly one place.
 */
export interface CapturePrivacyPort {
  setBroadcastMode(on: boolean): Promise<void>;
  isBroadcastMode(): Promise<boolean>;
  /** Fired on ANY change, including engine-initiated ones (startup restore). */
  onChanged(cb: (on: boolean) => void): Unsubscribe;
}

/** Balta (P0 #8) control surface — implementation lands in Faz 1. */
export interface AdblockPort {
  setEnabled(on: boolean): Promise<void>;
  setSiteWhitelisted(origin: string, whitelisted: boolean): Promise<void>;
  getStats(): Promise<{ blockedTotal: number }>;
}

/** DoH (P0 #11) control surface — implementation lands in Faz 1. */
export interface SecureDnsPort {
  setMode(mode: 'off' | 'automatic' | 'custom', providerUrl?: string): Promise<void>;
  getMode(): Promise<{ mode: 'off' | 'automatic' | 'custom'; providerUrl?: string }>;
}

/**
 * Content injection for the native emote engine + "Kick Plus" enhancements
 * (P0 #6): render emote segments inside kick.com/twitch.tv chat DOM.
 */
export interface ContentInjectionPort {
  injectCss(tabId: string, css: string): Promise<Unsubscribe>;
  injectScript(tabId: string, code: string): Promise<void>;
}

export interface EngineAdapter {
  readonly kind: EngineKind;
  readonly tabs: TabManager;
  readonly windows: WindowManager;
  readonly net: NetworkBridge;
  readonly storage: KeyValueStore;
  readonly secureStorage: SecureStore;
  readonly notifications: NotificationPort;
  readonly hotkeys: GlobalHotkeyPort;
  readonly capture: CapturePrivacyPort;
  readonly adblock: AdblockPort;
  readonly secureDns: SecureDnsPort;
  readonly contentInjection: ContentInjectionPort;
}
