import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../../engine/mock.js';
import {
  computePkceChallenge,
  KickAuthService,
  type KickAuthConfig,
  type KickAuthState,
  type KickTokenResponse,
} from './auth.js';

const CONFIG: KickAuthConfig = {
  clientId: 'jah-client',
  redirectUri: 'http://127.0.0.1:53189/callback',
  scopes: ['user:read', 'channel:read', 'chat:write', 'events:subscribe'],
};

function tokenResponse(n: number): KickTokenResponse {
  return {
    access_token: `access-${n}`,
    refresh_token: `refresh-${n}`,
    token_type: 'Bearer',
    expires_in: 7200,
    scope: CONFIG.scopes.join(' '),
  };
}

function makeService(overrides?: Partial<KickAuthConfig>) {
  const engine = new MockEngineAdapter();
  let nowMs = 1_000_000;
  const clock = { advanceSec: (s: number) => (nowMs += s * 1000) };
  const tokenCalls: string[] = [];
  let nextToken = 1;
  engine.net.respondWith('https://id.kick.com/oauth/token', (_url, init) => {
    tokenCalls.push(init?.body ?? '');
    return tokenResponse(nextToken++);
  });
  engine.net.respondWith('https://id.kick.com/oauth/revoke', () => ({}));
  const svc = new KickAuthService(engine, { ...CONFIG, ...overrides }, () => nowMs);
  return { engine, svc, clock, tokenCalls };
}

async function signIn(svc: KickAuthService): Promise<string> {
  const { authorizeUrl, state } = await svc.beginSignIn();
  expect(authorizeUrl).toContain('code_challenge_method=S256');
  await svc.completeSignIn(`${CONFIG.redirectUri}?code=auth-code-1&state=${state}`);
  return state;
}

describe('computePkceChallenge', () => {
  it('matches the RFC 7636 appendix B test vector', async () => {
    expect(await computePkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('KickAuthService', () => {
  it('builds a compliant authorize URL', async () => {
    const { svc } = makeService();
    const { authorizeUrl } = await svc.beginSignIn();
    const url = new URL(authorizeUrl);
    expect(url.origin + url.pathname).toBe('https://id.kick.com/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('jah-client');
    expect(url.searchParams.get('redirect_uri')).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get('scope')).toBe('user:read channel:read chat:write events:subscribe');
    expect(url.searchParams.get('state')).toMatch(/^[\w-]{20,}$/);
    expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{40,}$/);
  });

  it('completes sign-in: validates state, exchanges code, persists rotated refresh token', async () => {
    const { engine, svc, tokenCalls } = makeService();
    const states: KickAuthState[] = [];
    svc.onAuthStateChanged((s) => states.push(s));

    await signIn(svc);

    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0]).toContain('grant_type=authorization_code');
    expect(tokenCalls[0]).toContain('code_verifier=');
    expect(tokenCalls[0]).not.toContain('client_secret'); // secretless-first PoC
    expect(await svc.getAccessToken()).toBe('access-1');
    expect(await engine.secureStorage.get('kick-auth:refresh-token')).toBe('refresh-1');
    expect(states).toEqual(['signed-in']);
  });

  it('rejects a callback with mismatching state (CSRF)', async () => {
    const { svc } = makeService();
    await svc.beginSignIn();
    await expect(
      svc.completeSignIn(`${CONFIG.redirectUri}?code=x&state=sahte-state`),
    ).rejects.toThrow('state mismatch');
  });

  it('refreshes an expired token with rotation, single-flight under concurrency', async () => {
    const { engine, svc, clock, tokenCalls } = makeService();
    await signIn(svc);
    expect(await svc.getAccessToken()).toBe('access-1');

    clock.advanceSec(7200); // access token expired
    const [a, b] = await Promise.all([svc.getAccessToken(), svc.getAccessToken()]);
    expect(a).toBe('access-2');
    expect(b).toBe('access-2');
    // exchange + EXACTLY ONE refresh (concurrent refresh would burn the rotated token)
    expect(tokenCalls).toHaveLength(2);
    expect(tokenCalls[1]).toContain('grant_type=refresh_token');
    expect(tokenCalls[1]).toContain('refresh_token=refresh-1');
    expect(await engine.secureStorage.get('kick-auth:refresh-token')).toBe('refresh-2');
  });

  it('restores a session from secure storage and lazily refreshes', async () => {
    const first = makeService();
    await signIn(first.svc);

    // "restart": new service instance over the same engine storage
    const svc2 = new KickAuthService(first.engine, CONFIG, () => Date.now());
    expect(await svc2.restore()).toBe(true);
    expect(svc2.getState()).toBe('signed-in');
    expect(await svc2.getAccessToken()).toBe('access-2'); // lazy refresh with stored token
  });

  it('drops to needs-reauth when refresh permanently fails', async () => {
    // dedicated engine: responder succeeds for the code exchange, fails for refresh
    const engine2 = new MockEngineAdapter();
    let calls = 0;
    engine2.net.respondWith('https://id.kick.com/oauth/token', (_url, init) => {
      calls++;
      if ((init?.body ?? '').includes('authorization_code')) return tokenResponse(1);
      throw new Error('invalid_grant');
    });
    engine2.net.respondWith('https://id.kick.com/oauth/revoke', () => ({}));
    let now2 = 1_000_000;
    const svc2 = new KickAuthService(engine2, CONFIG, () => now2);
    const states: KickAuthState[] = [];
    svc2.onAuthStateChanged((s) => states.push(s));
    const { state } = await svc2.beginSignIn();
    await svc2.completeSignIn(`${CONFIG.redirectUri}?code=c&state=${state}`);
    now2 += 7200 * 1000;

    await expect(svc2.getAccessToken()).rejects.toThrow('invalid_grant');
    expect(svc2.getState()).toBe('needs-reauth');
    expect(await engine2.secureStorage.get('kick-auth:refresh-token')).toBeUndefined();
    expect(states).toEqual(['signed-in', 'needs-reauth']);
    expect(calls).toBe(2);
  });

  it('uses the token broker when configured (secret stays server-side)', async () => {
    const engine = new MockEngineAdapter();
    const brokerCalls: Array<{ url: string; body: string }> = [];
    engine.net.respondWith('https://broker.jahbrowser.app/', (url, init) => {
      brokerCalls.push({ url, body: init?.body ?? '' });
      return tokenResponse(1);
    });
    const svc = new KickAuthService(engine, {
      ...CONFIG,
      broker: {
        exchangeUrl: 'https://broker.jahbrowser.app/exchange',
        refreshUrl: 'https://broker.jahbrowser.app/refresh',
      },
    });
    const { state } = await svc.beginSignIn();
    await svc.completeSignIn(`${CONFIG.redirectUri}?code=broker-code&state=${state}`);

    expect(brokerCalls).toHaveLength(1);
    expect(brokerCalls[0].url).toBe('https://broker.jahbrowser.app/exchange');
    expect(JSON.parse(brokerCalls[0].body)).toMatchObject({
      code: 'broker-code',
      redirectUri: CONFIG.redirectUri,
    });
  });

  it('signOut revokes, wipes storage, and blocks further token use', async () => {
    const { engine, svc } = makeService();
    await signIn(svc);

    await svc.signOut();
    expect(svc.getState()).toBe('signed-out');
    expect(await engine.secureStorage.get('kick-auth:refresh-token')).toBeUndefined();
    await expect(svc.getAccessToken()).rejects.toThrow('not signed in');
  });
});
