import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../../engine/mock.js';
import { KickChatConnection, parseKickChatFrame } from './chat.js';
import type { KickChatMessage } from './types.js';

function chatFrame(chatroomId: number, content: string): string {
  return JSON.stringify({
    event: 'App\\Events\\ChatMessageEvent',
    data: JSON.stringify({
      id: `msg-${content}`,
      chatroom_id: chatroomId,
      content,
      created_at: '2026-07-04T20:00:00Z',
      sender: {
        username: 'jaharia_uyesi',
        identity: { color: '#ff5500', badges: [{ type: 'moderator' }, { type: 'og' }] },
      },
    }),
  });
}

describe('parseKickChatFrame', () => {
  it('parses a Pusher ChatMessageEvent frame', () => {
    const msg = parseKickChatFrame(chatFrame(42, 'reyiz KEKW'));
    expect(msg).toEqual({
      id: 'msg-reyiz KEKW',
      chatroomId: 42,
      senderUsername: 'jaharia_uyesi',
      senderColor: '#ff5500',
      content: 'reyiz KEKW',
      createdAt: '2026-07-04T20:00:00Z',
      badges: ['moderator', 'og'],
    });
  });

  it('ignores non-chat frames and malformed payloads', () => {
    expect(parseKickChatFrame(JSON.stringify({ event: 'pusher:pong', data: '{}' }))).toBeNull();
    expect(parseKickChatFrame('bozuk json {{')).toBeNull();
    expect(parseKickChatFrame(JSON.stringify({ event: 'App\\Events\\ChatMessageEvent' }))).toBeNull();
  });
});

describe('KickChatConnection', () => {
  it('subscribes on open, answers pusher:ping with pusher:pong, delivers messages', async () => {
    const engine = new MockEngineAdapter();
    const conn = new KickChatConnection(engine.net, { wsUrl: 'wss://fake-pusher' });
    const received: KickChatMessage[] = [];
    conn.onMessage((m) => received.push(m));

    await conn.connect(42);
    const socket = engine.net.sockets[0];

    socket.emitOpen();
    expect(JSON.parse(socket.sent[0])).toEqual({
      event: 'pusher:subscribe',
      data: { auth: '', channel: 'chatrooms.42.v2' },
    });

    // protokol gereği: ping'e pong dönülmezse sunucu bağlantıyı keser
    socket.emitMessage(JSON.stringify({ event: 'pusher:ping', data: {} }));
    expect(JSON.parse(socket.sent[1])).toEqual({ event: 'pusher:pong', data: {} });

    socket.emitMessage(chatFrame(42, 'selam reyiz'));
    expect(received).toHaveLength(1);
    expect(received[0].content).toBe('selam reyiz');

    conn.disconnect();
    expect(socket.closed).toBe(true);
  });

  it('switching channels tears down the old socket — no cross-chatroom leak', async () => {
    const engine = new MockEngineAdapter();
    const conn = new KickChatConnection(engine.net, { wsUrl: 'wss://fake-pusher' });
    const received: KickChatMessage[] = [];
    conn.onMessage((m) => received.push(m));

    await conn.connect(42);
    const oldSocket = engine.net.sockets[0];
    oldSocket.emitOpen();

    await conn.connect(43); // kanal değişimi
    const newSocket = engine.net.sockets[1];
    expect(oldSocket.closed).toBe(true);

    // eski soket üzerinden gelen mesaj artık akmamalı
    oldSocket.emitMessage(chatFrame(42, 'eski kanal mesajı'));
    expect(received).toHaveLength(0);

    newSocket.emitOpen();
    expect(JSON.parse(newSocket.sent[0]).data.channel).toBe('chatrooms.43.v2');
    newSocket.emitMessage(chatFrame(43, 'yeni kanal mesajı'));
    expect(received).toHaveLength(1);
  });

  it('reconnects after an unexpected close (unless user disconnected)', async () => {
    const engine = new MockEngineAdapter();
    const conn = new KickChatConnection(engine.net, { wsUrl: 'wss://fake-pusher' }, 1);
    await conn.connect(42);

    engine.net.sockets[0].close(); // sunucu düşürdü
    await new Promise((r) => setTimeout(r, 10));
    expect(engine.net.sockets).toHaveLength(2); // yeniden bağlandı

    conn.disconnect();
    engine.net.sockets[1].close();
    await new Promise((r) => setTimeout(r, 10));
    expect(engine.net.sockets).toHaveLength(2); // kullanıcı kapattı: reconnect yok
  });
});
