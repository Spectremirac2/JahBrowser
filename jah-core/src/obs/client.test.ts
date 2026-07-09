import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import type { FakeEngineSocket } from '../engine/mock.js';
import { computeObsAuthString, ObsWebSocketClient, OBS_DEFAULT_URL } from './client.js';

/** Let queued microtasks/macrotasks (crypto.subtle awaits, timers) run. */
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** crypto.subtle chains may need more than one macrotask — poll instead of guessing. */
const waitFor = async (cond: () => boolean, timeoutMs = 1000) => {
  const start = performance.now();
  while (!cond()) {
    if (performance.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await tick();
  }
};

function hello(auth?: { challenge: string; salt: string }): string {
  return JSON.stringify({
    op: 0,
    d: {
      obsWebSocketVersion: '5.5.2',
      rpcVersion: 1,
      ...(auth ? { authentication: auth } : {}),
    },
  });
}

const IDENTIFIED = JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } });

/** Drive the full Hello -> Identify -> Identified handshake on a fake socket. */
async function completeHandshake(socket: FakeEngineSocket): Promise<void> {
  socket.emitOpen();
  socket.emitMessage(hello());
  await tick();
  socket.emitMessage(IDENTIFIED);
}

// Fixture cross-checked against Node's crypto module:
//   secret = base64(sha256(password + salt)) = "Ln68W1UNXYyY7xDwp+h5foYLI6bzI1qZjKokTa5ZdwE="
//   auth   = base64(sha256(secret + challenge))
const AUTH_FIXTURE = {
  password: 'supersecretpassword',
  salt: 'PZVbYpvAnZut2SS6JNJytDm9',
  challenge: 'ztTBnnuqrqaKDzRM3xcVdbYm',
  expected: 'zZgWipvwSGrw748kHN4gNpBC1IaeiiWX3Hjkrm849Sc=',
};

describe('computeObsAuthString', () => {
  it('produces base64(sha256(base64(sha256(password+salt)) + challenge))', async () => {
    const auth = await computeObsAuthString(
      AUTH_FIXTURE.password,
      AUTH_FIXTURE.salt,
      AUTH_FIXTURE.challenge,
    );
    expect(auth).toBe(AUTH_FIXTURE.expected);
  });
});

describe('ObsWebSocketClient handshake', () => {
  it('answers Hello (no auth challenge) with a bare Identify, then reports identified', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    let identifiedFired = 0;
    client.onIdentified(() => identifiedFired++);

    await client.connect();
    const socket = engine.net.sockets[0];
    socket.emitOpen();
    expect(client.isIdentified).toBe(false);

    socket.emitMessage(hello());
    await waitFor(() => socket.sent.length >= 1);
    expect(JSON.parse(socket.sent[0])).toEqual({ op: 1, d: { rpcVersion: 1 } });

    socket.emitMessage(IDENTIFIED);
    expect(client.isIdentified).toBe(true);
    expect(identifiedFired).toBe(1);
  });

  it('answers an auth challenge with the exact protocol-v5 auth string', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net, { password: AUTH_FIXTURE.password });

    await client.connect();
    const socket = engine.net.sockets[0];
    socket.emitOpen();
    socket.emitMessage(hello({ challenge: AUTH_FIXTURE.challenge, salt: AUTH_FIXTURE.salt }));
    await waitFor(() => socket.sent.length >= 1);

    expect(JSON.parse(socket.sent[0])).toEqual({
      op: 1,
      d: { rpcVersion: 1, authentication: AUTH_FIXTURE.expected },
    });
  });

  it('connect() is idempotent — a second call opens no second socket', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    await client.connect();
    await client.connect();
    expect(engine.net.sockets).toHaveLength(1);
    expect(client).toBeInstanceOf(ObsWebSocketClient);
    expect(OBS_DEFAULT_URL).toBe('ws://127.0.0.1:4455');
  });
});

describe('ObsWebSocketClient events', () => {
  it('maps StreamStateChanged STARTED/STOPPED to onStreamStateChanged(active)', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    const seen: boolean[] = [];
    client.onStreamStateChanged((active) => seen.push(active));

    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);

    const streamEvent = (outputState: string, outputActive: boolean) =>
      JSON.stringify({
        op: 5,
        d: { eventType: 'StreamStateChanged', eventIntent: 64, eventData: { outputActive, outputState } },
      });

    // transitional states must NOT toggle Yayın Modu
    socket.emitMessage(streamEvent('OBS_WEBSOCKET_OUTPUT_STARTING', false));
    expect(seen).toEqual([]);

    socket.emitMessage(streamEvent('OBS_WEBSOCKET_OUTPUT_STARTED', true));
    socket.emitMessage(streamEvent('OBS_WEBSOCKET_OUTPUT_RECONNECTING', true));
    socket.emitMessage(streamEvent('OBS_WEBSOCKET_OUTPUT_STOPPED', false));
    expect(seen).toEqual([true, false]);
  });

  it('routes RecordStateChanged to its own callback, not the stream one', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    const stream: boolean[] = [];
    const record: boolean[] = [];
    client.onStreamStateChanged((a) => stream.push(a));
    client.onRecordStateChanged((a) => record.push(a));

    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);

    socket.emitMessage(
      JSON.stringify({
        op: 5,
        d: {
          eventType: 'RecordStateChanged',
          eventIntent: 64,
          eventData: { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED', outputPath: null },
        },
      }),
    );
    expect(record).toEqual([true]);
    expect(stream).toEqual([]);
  });
});

describe('ObsWebSocketClient requests', () => {
  it('correlates op 6/7 by requestId even when responses arrive out of order', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);

    const statusPromise = client.getStreamStatus();
    const replayPromise = client.saveReplayBuffer();

    const first = JSON.parse(socket.sent[1]) as { op: number; d: { requestType: string; requestId: string } };
    const second = JSON.parse(socket.sent[2]) as { op: number; d: { requestType: string; requestId: string } };
    expect(first).toEqual({ op: 6, d: { requestType: 'GetStreamStatus', requestId: first.d.requestId } });
    expect(second.d.requestType).toBe('SaveReplayBuffer');
    expect(second.d.requestId).not.toBe(first.d.requestId);

    // answer in REVERSE order — correlation must survive
    socket.emitMessage(
      JSON.stringify({
        op: 7,
        d: {
          requestType: 'SaveReplayBuffer',
          requestId: second.d.requestId,
          requestStatus: { result: true, code: 100 },
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        op: 7,
        d: {
          requestType: 'GetStreamStatus',
          requestId: first.d.requestId,
          requestStatus: { result: true, code: 100 },
          responseData: {
            outputActive: true,
            outputReconnecting: false,
            outputTimecode: '00:42:00.000',
            outputDuration: 2_520_000,
            outputCongestion: 0,
            outputBytes: 123,
            outputSkippedFrames: 0,
            outputTotalFrames: 75_600,
          },
        },
      }),
    );

    await expect(replayPromise).resolves.toBeUndefined();
    const status = await statusPromise;
    expect(status.outputActive).toBe(true);
    expect(status.outputTimecode).toBe('00:42:00.000');
  });

  it('rejects on requestStatus.result=false with code and comment', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);

    const promise = client.saveReplayBuffer();
    const sent = JSON.parse(socket.sent[1]) as { d: { requestId: string } };
    socket.emitMessage(
      JSON.stringify({
        op: 7,
        d: {
          requestType: 'SaveReplayBuffer',
          requestId: sent.d.requestId,
          requestStatus: { result: false, code: 604, comment: 'replay buffer not active' },
        },
      }),
    );
    await expect(promise).rejects.toThrow(/604.*replay buffer not active/);
  });

  it('refuses to send before identification completes', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net);
    await client.connect();
    await expect(client.getStreamStatus()).rejects.toThrow(/not identified/);
  });

  it('fails in-flight requests when the socket drops', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net, { reconnectDelayMs: 1 });
    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);

    const promise = client.getStreamStatus();
    socket.close(); // server dropped mid-request
    await expect(promise).rejects.toThrow(/socket closed/);
  });
});

describe('ObsWebSocketClient reconnect', () => {
  it('re-dials after an unexpected close and can identify again', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net, { reconnectDelayMs: 1 });
    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);
    expect(client.isIdentified).toBe(true);

    socket.close(); // OBS quit / crashed
    expect(client.isIdentified).toBe(false);
    await tick(10);
    expect(engine.net.sockets).toHaveLength(2);

    await completeHandshake(engine.net.sockets[1]);
    expect(client.isIdentified).toBe(true);
  });

  it('does NOT reconnect after a clean disconnect()', async () => {
    const engine = new MockEngineAdapter();
    const client = new ObsWebSocketClient(engine.net, { reconnectDelayMs: 1 });
    await client.connect();
    const socket = engine.net.sockets[0];
    await completeHandshake(socket);

    client.disconnect();
    expect(socket.closed).toBe(true);
    await tick(10);
    expect(engine.net.sockets).toHaveLength(1);

    // and a fresh connect() after disconnect() works again
    await client.connect();
    expect(engine.net.sockets).toHaveLength(2);
  });
});
