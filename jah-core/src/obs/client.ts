import type { EngineSocket, NetworkBridge, Unsubscribe } from '../engine/types.js';

/**
 * OBS Studio websocket client — obs-websocket PROTOCOL v5.
 *
 * Backbone of the "Yayın Modu" auto-trigger (P0 #9): when OBS reports the
 * stream output went live, jah-core flips broadcast mode on (and off when the
 * stream stops). Later it also powers the Çentik+ replay-buffer flow via
 * saveReplayBuffer().
 *
 * Protocol reference (verified 2026-07-04):
 * https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
 * - Envelope: `{ op: number, d: object }`
 * - Handshake: Hello (op 0) -> Identify (op 1) -> Identified (op 2)
 * - Events arrive as op 5, requests go out as op 6, responses come back as op 7
 * - Default server: ws://127.0.0.1:4455 (obs-websocket default port 4455)
 *
 * SECURITY (Faz 1 plan): connections are localhost-only by design — this
 * client talks to the streamer's own OBS instance, never a remote host. The
 * password is NOT persisted by jah-core; the caller loads it from the OS
 * keychain and passes it in. If OBS requires auth and the password is wrong
 * or missing, OBS closes the socket after Identify; we then retry on the
 * fixed reconnect delay (the caller can watch onIdentified to detect that
 * identification never completes).
 */

/** Default obs-websocket endpoint (local OBS instance, default port 4455). */
export const OBS_DEFAULT_URL = 'ws://127.0.0.1:4455';

/** obs-websocket rpcVersion this client implements (protocol v5 == rpcVersion 1). */
const OBS_RPC_VERSION = 1;

/** WebSocketOpCode values from protocol.md. */
const enum ObsOpCode {
  Hello = 0,
  Identify = 1,
  Identified = 2,
  Event = 5,
  Request = 6,
  RequestResponse = 7,
}

export interface ObsClientOptions {
  /** obs-websocket URL; localhost-only per security plan. */
  url?: string;
  /** Password from the OS keychain (Faz 1); omit when OBS auth is disabled. */
  password?: string;
  /** Fixed delay before re-dialing after an unexpected close. */
  reconnectDelayMs?: number;
}

/**
 * GetStreamStatus response fields, verified against
 * docs/generated/protocol.json (request "GetStreamStatus").
 */
export interface ObsStreamStatus {
  outputActive: boolean;
  outputReconnecting: boolean;
  outputTimecode: string;
  outputDuration: number;
  outputCongestion: number;
  outputBytes: number;
  outputSkippedFrames: number;
  outputTotalFrames: number;
}

/** Incoming protocol envelope (fields depend on op). */
interface ObsEnvelope {
  op?: number;
  d?: {
    // Hello (op 0)
    rpcVersion?: number;
    authentication?: { challenge: string; salt: string };
    // Identified (op 2)
    negotiatedRpcVersion?: number;
    // Event (op 5)
    eventType?: string;
    eventIntent?: number;
    eventData?: Record<string, unknown>;
    // RequestResponse (op 7)
    requestType?: string;
    requestId?: string;
    requestStatus?: { result: boolean; code: number; comment?: string };
    responseData?: Record<string, unknown>;
  };
}

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (err: Error) => void;
}

/** Encode raw bytes as base64 without relying on DOM btoa or Node Buffer. */
function bytesToBase64(bytes: Uint8Array): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? ALPHABET[b2 & 0x3f] : '=';
  }
  return out;
}

async function sha256Base64(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToBase64(new Uint8Array(digest));
}

/**
 * obs-websocket v5 authentication string, exactly per protocol.md
 * "Creating an authentication string":
 *   1. secret = base64(sha256(password + salt))
 *   2. auth   = base64(sha256(secret + challenge))
 */
export async function computeObsAuthString(
  password: string,
  salt: string,
  challenge: string,
): Promise<string> {
  const secret = await sha256Base64(password + salt);
  return sha256Base64(secret + challenge);
}

export class ObsWebSocketClient {
  private socket: EngineSocket | null = null;
  private socketSubs: Unsubscribe[] = [];
  private identified = false;
  private closedByUser = true; // no auto-dialing before the first connect()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly streamStateCbs = new Set<(active: boolean) => void>();
  private readonly recordStateCbs = new Set<(active: boolean) => void>();
  private readonly identifiedCbs = new Set<() => void>();

  private readonly url: string;
  private readonly password?: string;
  private readonly reconnectDelayMs: number;

  constructor(
    private readonly net: NetworkBridge,
    options: ObsClientOptions = {},
  ) {
    this.url = options.url ?? OBS_DEFAULT_URL;
    this.password = options.password;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3_000;
  }

  /**
   * Idempotent: a second call while a socket is live (or dialing) is a no-op.
   * Resolves once the socket is opened; identification (Hello -> Identify ->
   * Identified) completes asynchronously — observe it via onIdentified().
   */
  async connect(): Promise<void> {
    if (this.socket) return;
    this.closedByUser = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.dial();
  }

  /** Clean disconnect: no reconnect will follow. */
  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardownSocket();
  }

  get isIdentified(): boolean {
    return this.identified;
  }

  /** Fires with `true` on OBS_WEBSOCKET_OUTPUT_STARTED, `false` on ..._STOPPED. */
  onStreamStateChanged(cb: (active: boolean) => void): Unsubscribe {
    this.streamStateCbs.add(cb);
    return () => this.streamStateCbs.delete(cb);
  }

  /** Fires with `true` on OBS_WEBSOCKET_OUTPUT_STARTED, `false` on ..._STOPPED. */
  onRecordStateChanged(cb: (active: boolean) => void): Unsubscribe {
    this.recordStateCbs.add(cb);
    return () => this.recordStateCbs.delete(cb);
  }

  /** Fires every time the handshake completes (initial connect and reconnects). */
  onIdentified(cb: () => void): Unsubscribe {
    this.identifiedCbs.add(cb);
    return () => this.identifiedCbs.delete(cb);
  }

  /**
   * Send a Request (op 6) and await the correlated RequestResponse (op 7).
   * Rejects when requestStatus.result is false or the socket drops.
   */
  async request<T = Record<string, unknown>>(
    type: string,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const socket = this.socket;
    if (!socket || !this.identified) {
      throw new Error(`obs: cannot send ${type} — not identified yet`);
    }
    const requestId = `jah-${this.nextRequestId++}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (d) => resolve(d as T),
        reject,
      });
      socket.send(
        JSON.stringify({
          op: ObsOpCode.Request,
          d: {
            requestType: type,
            requestId,
            ...(data !== undefined ? { requestData: data } : {}),
          },
        }),
      );
    });
  }

  /** Typed helper for the Yayın Modu trigger's initial-state probe. */
  getStreamStatus(): Promise<ObsStreamStatus> {
    return this.request<ObsStreamStatus>('GetStreamStatus');
  }

  /** Typed helper for Çentik+ — flush OBS's replay buffer to disk. */
  async saveReplayBuffer(): Promise<void> {
    await this.request('SaveReplayBuffer');
  }

  private async dial(): Promise<void> {
    const socket = await this.net.openSocket(this.url);
    this.socket = socket;
    this.socketSubs.push(
      socket.onMessage((raw) => void this.handleFrame(socket, raw)),
      socket.onClose(() => this.handleUnexpectedClose()),
    );
  }

  private async handleFrame(socket: EngineSocket, raw: string): Promise<void> {
    let envelope: ObsEnvelope;
    try {
      envelope = JSON.parse(raw) as ObsEnvelope;
    } catch {
      return; // not a protocol frame; ignore
    }
    const d = envelope.d ?? {};
    switch (envelope.op) {
      case ObsOpCode.Hello: {
        // Hello may carry an auth challenge; answer with Identify (op 1).
        let authentication: string | undefined;
        if (d.authentication && this.password !== undefined) {
          authentication = await computeObsAuthString(
            this.password,
            d.authentication.salt,
            d.authentication.challenge,
          );
        }
        // eventSubscriptions omitted: defaults to EventSubscription::All,
        // which includes the Outputs category (StreamStateChanged etc.).
        socket.send(
          JSON.stringify({
            op: ObsOpCode.Identify,
            d: {
              rpcVersion: OBS_RPC_VERSION,
              ...(authentication !== undefined ? { authentication } : {}),
            },
          }),
        );
        return;
      }
      case ObsOpCode.Identified: {
        this.identified = true;
        for (const cb of this.identifiedCbs) cb();
        return;
      }
      case ObsOpCode.Event: {
        this.handleEvent(d.eventType, d.eventData);
        return;
      }
      case ObsOpCode.RequestResponse: {
        if (!d.requestId) return;
        const pending = this.pending.get(d.requestId);
        if (!pending) return;
        this.pending.delete(d.requestId);
        if (d.requestStatus?.result) {
          pending.resolve(d.responseData ?? {});
        } else {
          const code = d.requestStatus?.code ?? -1;
          const comment = d.requestStatus?.comment ?? 'no comment';
          pending.reject(new Error(`obs: ${d.requestType ?? 'request'} failed (${code}): ${comment}`));
        }
        return;
      }
      default:
        return;
    }
  }

  private handleEvent(eventType?: string, eventData?: Record<string, unknown>): void {
    if (eventType !== 'StreamStateChanged' && eventType !== 'RecordStateChanged') return;
    // Only the terminal states flip the switch; STARTING/STOPPING/
    // RECONNECTING etc. are transitional and must not toggle Yayın Modu.
    const state = eventData?.outputState;
    let active: boolean;
    if (state === 'OBS_WEBSOCKET_OUTPUT_STARTED') active = true;
    else if (state === 'OBS_WEBSOCKET_OUTPUT_STOPPED') active = false;
    else return;
    const cbs = eventType === 'StreamStateChanged' ? this.streamStateCbs : this.recordStateCbs;
    for (const cb of cbs) cb(active);
  }

  private handleUnexpectedClose(): void {
    this.teardownSocket();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUser) return;
      void this.dial().catch(() => this.scheduleReconnect());
    }, this.reconnectDelayMs);
  }

  /** Unsubscribe handlers BEFORE closing so teardown can't trigger reconnect. */
  private teardownSocket(): void {
    for (const unsub of this.socketSubs) unsub();
    this.socketSubs = [];
    this.identified = false;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    // A dead socket can never answer: fail in-flight requests loudly.
    for (const [, pending] of this.pending) {
      pending.reject(new Error('obs: socket closed before response'));
    }
    this.pending.clear();
  }
}
