import type {
  AdblockPort,
  CapturePrivacyPort,
  ContentInjectionPort,
  CreateTabOptions,
  EngineAdapter,
  EngineSocket,
  GlobalHotkeyPort,
  JahRequestInit,
  KeyValueStore,
  NetworkBridge,
  NotificationOptions,
  NotificationPort,
  SecureDnsPort,
  TabInfo,
  TabManager,
  Unsubscribe,
  WindowManager,
} from './types.js';

/**
 * Fully hermetic in-memory engine adapter: no real network, no engine.
 * Reference implementation for what real adapters must provide, plus test
 * helpers (FakeEngineSocket, respondWith, emitUpdated).
 */

export class FakeEngineSocket implements EngineSocket {
  readonly sent: string[] = [];
  closed = false;
  private openCbs = new Set<() => void>();
  private messageCbs = new Set<(data: string) => void>();
  private closeCbs = new Set<() => void>();

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const cb of this.closeCbs) cb();
  }

  onOpen(cb: () => void): Unsubscribe {
    this.openCbs.add(cb);
    return () => this.openCbs.delete(cb);
  }

  onMessage(cb: (data: string) => void): Unsubscribe {
    this.messageCbs.add(cb);
    return () => this.messageCbs.delete(cb);
  }

  onClose(cb: () => void): Unsubscribe {
    this.closeCbs.add(cb);
    return () => this.closeCbs.delete(cb);
  }

  // --- test helpers ---
  emitOpen(): void {
    for (const cb of this.openCbs) cb();
  }

  emitMessage(data: string): void {
    for (const cb of this.messageCbs) cb(data);
  }
}

export interface MockNetwork extends NetworkBridge {
  /** Every socket opened, in order — inspect/drive them in tests. */
  sockets: FakeEngineSocket[];
  /** Queue a canned JSON response for URLs starting with `urlPrefix`. */
  respondWith(urlPrefix: string, respond: (url: string, init?: JahRequestInit) => unknown): void;
}

export interface MockTabManager extends TabManager {
  /** Re-emit onUpdated for a tab after mutating it directly in a test. */
  emitUpdated(tabId: string): void;
}

export class MockEngineAdapter implements EngineAdapter {
  readonly kind = 'mock' as const;
  readonly tabs: MockTabManager;
  readonly windows: WindowManager;
  readonly net: MockNetwork;
  readonly storage: KeyValueStore;
  readonly secureStorage: KeyValueStore;
  readonly notifications: NotificationPort & { shown: NotificationOptions[] };
  readonly hotkeys: GlobalHotkeyPort & { registered: Map<string, () => void> };
  readonly capture: CapturePrivacyPort;
  readonly adblock: AdblockPort;
  readonly secureDns: SecureDnsPort;
  readonly contentInjection: ContentInjectionPort;

  constructor() {
    const tabs = new Map<string, TabInfo>();
    const updatedCbs = new Set<(tab: TabInfo) => void>();
    const closedCbs = new Set<(tabId: string) => void>();
    let nextId = 1;

    const emitUpdated = (tab: TabInfo) => {
      for (const cb of updatedCbs) cb(tab);
    };

    this.tabs = {
      list: async () => [...tabs.values()],
      create: async (opts: CreateTabOptions) => {
        const tab: TabInfo = {
          id: String(nextId++),
          url: opts.url,
          title: opts.url,
          active: opts.active ?? true,
          audible: false,
          muted: false,
          pinned: opts.pinned ?? false,
          streamKeepAlive: false,
        };
        tabs.set(tab.id, tab);
        return tab;
      },
      close: async (tabId: string) => {
        tabs.delete(tabId);
        for (const cb of closedCbs) cb(tabId);
      },
      activate: async (tabId: string) => {
        for (const t of tabs.values()) t.active = t.id === tabId;
      },
      setStreamKeepAlive: async (tabId: string, keepAlive: boolean) => {
        const t = tabs.get(tabId);
        if (!t) throw new Error(`no such tab: ${tabId}`);
        t.streamKeepAlive = keepAlive;
        emitUpdated(t);
      },
      setMuted: async (tabId: string, muted: boolean) => {
        const t = tabs.get(tabId);
        if (!t) throw new Error(`no such tab: ${tabId}`);
        t.muted = muted;
        emitUpdated(t);
      },
      setAudioLevel: async (tabId: string) => {
        if (!tabs.has(tabId)) throw new Error(`no such tab: ${tabId}`);
      },
      onUpdated: (cb): Unsubscribe => {
        updatedCbs.add(cb);
        return () => updatedCbs.delete(cb);
      },
      onClosed: (cb): Unsubscribe => {
        closedCbs.add(cb);
        return () => closedCbs.delete(cb);
      },
      emitUpdated: (tabId: string) => {
        const t = tabs.get(tabId);
        if (t) emitUpdated(t);
      },
    };

    let nextWindowId = 1;
    this.windows = {
      pipFromTab: async () => `mock-window-${nextWindowId++}`,
      openCompanionWindow: async () => `mock-window-${nextWindowId++}`,
      closeWindow: async () => {},
      setAlwaysOnTop: async () => {},
      setExcludeFromCapture: async () => {},
    };

    const sockets: FakeEngineSocket[] = [];
    const responders: Array<{
      prefix: string;
      respond: (url: string, init?: JahRequestInit) => unknown;
    }> = [];
    this.net = {
      sockets,
      respondWith: (urlPrefix, respond) => {
        responders.push({ prefix: urlPrefix, respond });
      },
      fetchJson: async <T>(url: string, init?: JahRequestInit): Promise<T> => {
        const responder = responders.find((r) => url.startsWith(r.prefix));
        if (!responder) {
          throw new Error(`MockEngineAdapter.net: no mock response registered for ${url}`);
        }
        return responder.respond(url, init) as T;
      },
      openSocket: async () => {
        const socket = new FakeEngineSocket();
        sockets.push(socket);
        return socket;
      },
    };

    const kv = new Map<string, unknown>();
    this.storage = {
      get: async <T>(key: string) => kv.get(key) as T | undefined,
      set: async (key, value) => void kv.set(key, value),
      delete: async (key) => void kv.delete(key),
    };

    const secureKv = new Map<string, unknown>();
    this.secureStorage = {
      get: async <T>(key: string) => secureKv.get(key) as T | undefined,
      set: async (key, value) => void secureKv.set(key, value),
      delete: async (key) => void secureKv.delete(key),
    };

    const shown: NotificationOptions[] = [];
    this.notifications = {
      shown,
      show: async (n: NotificationOptions) => void shown.push(n),
    };

    const registered = new Map<string, () => void>();
    this.hotkeys = {
      registered,
      register: async (accelerator: string, cb: () => void) => {
        if (registered.has(accelerator)) {
          throw new Error(`hotkey already registered: ${accelerator}`);
        }
        registered.set(accelerator, cb);
        return () => registered.delete(accelerator);
      },
    };

    let broadcastMode = false;
    const captureCbs = new Set<(on: boolean) => void>();
    this.capture = {
      setBroadcastMode: async (on: boolean) => {
        if (on === broadcastMode) return;
        broadcastMode = on;
        for (const cb of captureCbs) cb(on);
      },
      isBroadcastMode: async () => broadcastMode,
      onChanged: (cb): Unsubscribe => {
        captureCbs.add(cb);
        return () => captureCbs.delete(cb);
      },
    };

    this.adblock = {
      setEnabled: async () => {},
      setSiteWhitelisted: async () => {},
      getStats: async () => ({ blockedTotal: 0 }),
    };

    this.secureDns = {
      setMode: async () => {},
      getMode: async () => ({ mode: 'automatic' as const }),
    };

    this.contentInjection = {
      injectCss: async () => () => {},
      injectScript: async () => {},
    };
  }
}
