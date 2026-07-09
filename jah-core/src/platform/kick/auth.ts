import type { EngineAdapter, JahRequestInit, Unsubscribe } from '../../engine/types.js';
import type { TokenProvider } from '../types.js';

/**
 * Kick OAuth 2.1 (Authorization Code + PKCE S256) for a desktop browser.
 * Spec verified against docs.kick.com (2026-07) — see
 * research/12-entegrasyon-derinlesme/kick-oauth-akisi.md for the full study.
 *
 * Design decisions from that study:
 * - PKCE is mandatory; state + code_verifier are crypto-random per attempt.
 * - Kick's token endpoint may require client_secret (OAuth 2.1 public-client
 *   profile unverified). Order of preference: token BROKER (secret lives
 *   server-side) > direct exchange (secretless first; optional embedded
 *   secret only for closed beta).
 * - Refresh tokens ROTATE: every refresh returns a new refresh token, which
 *   must be persisted before use. Refresh is single-flight.
 * - Refresh token lives in engine secureStorage (DPAPI); access token stays
 *   in memory only.
 * - No fixed lifetimes are documented — always honor expires_in.
 */

export interface KickAuthEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl: string;
}

export const KICK_DEFAULT_ENDPOINTS: KickAuthEndpoints = {
  authorizeUrl: 'https://id.kick.com/oauth/authorize',
  tokenUrl: 'https://id.kick.com/oauth/token',
  revokeUrl: 'https://id.kick.com/oauth/revoke',
};

/** Token broker (e.g. Cloudflare Worker) that holds the client_secret. */
export interface KickTokenBroker {
  exchangeUrl: string;
  refreshUrl: string;
}

export interface KickAuthConfig {
  clientId: string;
  /** Must match the registered redirect URI EXACTLY (Kick enforces equality). */
  redirectUri: string;
  /** P0 minimum: 'user:read channel:read chat:write events:subscribe'. */
  scopes: string[];
  endpoints?: KickAuthEndpoints;
  broker?: KickTokenBroker;
  /** Closed-beta fallback only — extractable from the binary. Prefer broker. */
  clientSecret?: string;
}

export interface KickTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export type KickAuthState = 'signed-out' | 'signed-in' | 'needs-reauth';

export interface PendingSignIn {
  authorizeUrl: string;
  state: string;
}

const REFRESH_TOKEN_KEY = 'kick-auth:refresh-token';
/** Refresh proactively when less than this fraction of the lifetime remains. */
const EXPIRY_SAFETY_FRACTION = 0.2;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomUrlSafeString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(code_verifier))). */
export async function computePkceChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function formBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const FORM_INIT: Pick<JahRequestInit, 'method' | 'headers'> = {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
};

export class KickAuthService implements TokenProvider {
  private readonly endpoints: KickAuthEndpoints;
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshToken: string | null = null;
  private authState: KickAuthState = 'signed-out';
  private pending: { state: string; codeVerifier: string } | null = null;
  private refreshInFlight: Promise<string> | null = null;
  private listeners = new Set<(state: KickAuthState) => void>();

  constructor(
    private readonly engine: EngineAdapter,
    private readonly config: KickAuthConfig,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.endpoints = config.endpoints ?? KICK_DEFAULT_ENDPOINTS;
  }

  /** Hydrate a previous session (refresh token from secure storage). */
  async restore(): Promise<boolean> {
    const stored = await this.engine.secureStorage.get<string>(REFRESH_TOKEN_KEY);
    if (!stored) return false;
    this.refreshToken = stored;
    this.setState('signed-in'); // access token fetched lazily on first use
    return true;
  }

  getState(): KickAuthState {
    return this.authState;
  }

  onAuthStateChanged(cb: (state: KickAuthState) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Step 1: build the authorize URL. The UI opens it in an app-modal window
   * (reusing the user's kick.com session) and feeds the redirect back into
   * completeSignIn().
   */
  async beginSignIn(): Promise<PendingSignIn> {
    const state = randomUrlSafeString();
    const codeVerifier = randomUrlSafeString(48);
    this.pending = { state, codeVerifier };

    const url = new URL(this.endpoints.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', this.config.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', await computePkceChallenge(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
    return { authorizeUrl: url.toString(), state };
  }

  /** Step 2: consume the redirect callback URL (?code=...&state=...). */
  async completeSignIn(callbackUrl: string): Promise<void> {
    const pending = this.pending;
    if (!pending) throw new Error('KickAuth: no sign-in in progress');
    const params = new URL(callbackUrl).searchParams;
    const error = params.get('error');
    if (error) throw new Error(`KickAuth: authorize failed: ${error}`);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) throw new Error('KickAuth: callback has no code');
    if (state !== pending.state) throw new Error('KickAuth: state mismatch (CSRF?)');
    this.pending = null;

    const token = this.config.broker
      ? await this.engine.net.fetchJson<KickTokenResponse>(this.config.broker.exchangeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier: pending.codeVerifier,
            redirectUri: this.config.redirectUri,
          }),
        })
      : await this.engine.net.fetchJson<KickTokenResponse>(this.endpoints.tokenUrl, {
          ...FORM_INIT,
          body: formBody({
            grant_type: 'authorization_code',
            code,
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            code_verifier: pending.codeVerifier,
            ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
          }),
        });

    await this.applyTokens(token);
    this.setState('signed-in');
  }

  /** TokenProvider: returns a valid access token, refreshing when needed. */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }
    if (!this.refreshToken) {
      throw new Error('KickAuth: not signed in');
    }
    // Single-flight: rotation makes concurrent refreshes actively dangerous
    // (the second one would burn an already-rotated refresh token).
    this.refreshInFlight ??= this.refresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  async signOut(): Promise<void> {
    // Best-effort revoke; local sign-out must succeed regardless.
    const revoke = async (token: string, hint: string) => {
      await this.engine.net
        .fetchJson(`${this.endpoints.revokeUrl}?token=${encodeURIComponent(token)}&token_hint_type=${hint}`, {
          method: 'POST',
        })
        .catch(() => {});
    };
    if (this.accessToken) await revoke(this.accessToken, 'access_token');
    if (this.refreshToken) await revoke(this.refreshToken, 'refresh_token');
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.refreshToken = null;
    await this.engine.secureStorage.delete(REFRESH_TOKEN_KEY);
    this.setState('signed-out');
  }

  private async refresh(): Promise<string> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) throw new Error('KickAuth: not signed in');
    let token: KickTokenResponse;
    try {
      token = this.config.broker
        ? await this.engine.net.fetchJson<KickTokenResponse>(this.config.broker.refreshUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
        : await this.engine.net.fetchJson<KickTokenResponse>(this.endpoints.tokenUrl, {
            ...FORM_INIT,
            body: formBody({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: this.config.clientId,
              ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
            }),
          });
    } catch (err) {
      // Persistent refresh failure -> the session is gone; UI must re-auth.
      this.accessToken = null;
      this.accessTokenExpiresAt = 0;
      this.refreshToken = null;
      await this.engine.secureStorage.delete(REFRESH_TOKEN_KEY);
      this.setState('needs-reauth');
      throw err;
    }
    await this.applyTokens(token);
    return token.access_token;
  }

  /** Persist the (rotated) refresh token BEFORE anything can use the session. */
  private async applyTokens(token: KickTokenResponse): Promise<void> {
    this.refreshToken = token.refresh_token;
    await this.engine.secureStorage.set(REFRESH_TOKEN_KEY, token.refresh_token);
    this.accessToken = token.access_token;
    const lifetimeMs = token.expires_in * 1000;
    this.accessTokenExpiresAt = this.now() + lifetimeMs * (1 - EXPIRY_SAFETY_FRACTION);
  }

  private setState(state: KickAuthState): void {
    if (state === this.authState) return;
    this.authState = state;
    for (const cb of this.listeners) cb(state);
  }
}
