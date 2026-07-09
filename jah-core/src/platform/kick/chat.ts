import type { EngineSocket, NetworkBridge, Unsubscribe } from '../../engine/types.js';
import type { KickChatMessage } from './types.js';

/**
 * Kick chat connection.
 *
 * v0: read-only connection over Kick's public Pusher websocket — the same
 * channel community tools use. This is the documented FALLBACK path; it will
 * be swapped to official chat webhooks/API as Kick expands dev.kick.com
 * coverage. Endpoint/config values are intentionally injected (remotely
 * updatable "Kick Plus" component architecture) so a Kick-side change never
 * requires a binary update.
 */
export interface KickChatConfig {
  /** Pusher ws URL (app key + cluster), delivered by remote config — never hardcoded. */
  wsUrl: string;
}

/** Parse a raw Pusher frame into a chat message; null for non-chat frames. */
export function parseKickChatFrame(raw: string): KickChatMessage | null {
  try {
    const frame = JSON.parse(raw) as { event?: string; data?: string };
    if (frame.event !== 'App\\Events\\ChatMessageEvent' || !frame.data) return null;
    const d = JSON.parse(frame.data) as {
      id: string;
      chatroom_id: number;
      content: string;
      created_at: string;
      sender: { username: string; identity?: { color?: string; badges?: { type: string }[] } };
    };
    return {
      id: d.id,
      chatroomId: d.chatroom_id,
      senderUsername: d.sender.username,
      senderColor: d.sender.identity?.color,
      content: d.content,
      createdAt: d.created_at,
      badges: (d.sender.identity?.badges ?? []).map((b) => b.type),
    };
  } catch {
    return null;
  }
}

export class KickChatConnection {
  private socket: EngineSocket | null = null;
  private socketSubs: Unsubscribe[] = [];
  private listeners = new Set<(msg: KickChatMessage) => void>();
  private currentChatroomId: number | null = null;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly net: NetworkBridge,
    private readonly config: KickChatConfig,
    private readonly reconnectDelayMs = 3_000,
  ) {}

  /** Safe to call repeatedly — always tears down the previous socket first. */
  async connect(chatroomId: number): Promise<void> {
    this.teardownSocket();
    this.closedByUser = false;
    this.currentChatroomId = chatroomId;

    const socket = await this.net.openSocket(this.config.wsUrl);
    this.socket = socket;
    this.socketSubs.push(
      socket.onOpen(() => {
        socket.send(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: '', channel: `chatrooms.${chatroomId}.v2` },
          }),
        );
      }),
      socket.onMessage((raw) => this.handleFrame(socket, raw)),
      // Pusher drops silent clients; reconnect unless the user hung up.
      socket.onClose(() => this.scheduleReconnect()),
    );
  }

  disconnect(): void {
    this.closedByUser = true;
    this.currentChatroomId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardownSocket();
  }

  onMessage(cb: (msg: KickChatMessage) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private handleFrame(socket: EngineSocket, raw: string): void {
    // Protocol requirement: answer pusher:ping or the server disconnects us.
    try {
      const frame = JSON.parse(raw) as { event?: string };
      if (frame.event === 'pusher:ping') {
        socket.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        return;
      }
    } catch {
      return;
    }
    const msg = parseKickChatFrame(raw);
    if (msg) for (const cb of this.listeners) cb(msg);
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.currentChatroomId === null || this.reconnectTimer) return;
    const chatroomId = this.currentChatroomId;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(chatroomId).catch(() => this.scheduleReconnect());
    }, this.reconnectDelayMs);
  }

  /** Unsubscribe handlers BEFORE closing so the old socket can't trigger reconnect. */
  private teardownSocket(): void {
    for (const unsub of this.socketSubs) unsub();
    this.socketSubs = [];
    this.socket?.close();
    this.socket = null;
  }
}
