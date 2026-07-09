// Engine contract
export * from './engine/types.js';
export { MockEngineAdapter, FakeEngineSocket } from './engine/mock.js';
export type { MockNetwork, MockTabManager } from './engine/mock.js';

// Platform layer
export * from './platform/types.js';
export * from './platform/kick/types.js';
export { KickClient } from './platform/kick/client.js';
export { KickAuthService, computePkceChallenge, KICK_DEFAULT_ENDPOINTS } from './platform/kick/auth.js';
export type {
  KickAuthConfig,
  KickAuthEndpoints,
  KickAuthState,
  KickTokenBroker,
  KickTokenResponse,
  PendingSignIn,
} from './platform/kick/auth.js';
export { KickChatConnection, parseKickChatFrame } from './platform/kick/chat.js';
export type { KickChatConfig } from './platform/kick/chat.js';
export { TwitchClient, resolveTwitchThumbnail } from './platform/twitch/client.js';
export type { TwitchStream } from './platform/twitch/client.js';

// Emote engine
export * from './emotes/types.js';
export { EmoteEngine } from './emotes/engine.js';

// Live status services
export { FollowedChannelsService } from './live/followed.js';
export type { KickLiveApi, TwitchLiveApi } from './live/followed.js';

// OBS integration (Yayın Modu auto-trigger backbone + Çentik+ replay buffer)
export { ObsWebSocketClient, computeObsAuthString, OBS_DEFAULT_URL } from './obs/client.js';
export type { ObsClientOptions, ObsStreamStatus } from './obs/client.js';

// Emote providers (P0 #6 native emote engine data layer)
export { SevenTvEmoteProvider } from './emotes/providers/seventv.js';
export { BttvEmoteProvider } from './emotes/providers/bttv.js';
export { FfzEmoteProvider } from './emotes/providers/ffz.js';
export { KickEmoteProvider } from './emotes/providers/kick.js';
export type { KickEmoteConfig } from './emotes/providers/kick.js';
export { parseChannelKey } from './emotes/providers/helpers.js';
export type { ChannelPlatform, ParsedChannelKey } from './emotes/providers/helpers.js';

// Moderation (Dil Bekçisi)
export { DilBekcisi, normalizeTurkish, normalizeTurkishWithMap } from './moderation/dilbekcisi.js';
export type {
  ActionThresholds,
  DilBekcisiConfig,
  DilBekcisiMatch,
  DilBekcisiResult,
  SuggestedAction,
  Verdict,
} from './moderation/dilbekcisi.js';

// Stream health (Nabız)
export { NabizService } from './health/nabiz.js';
export type { NabizObsSource, NabizOptions, NabizSample, NabizState } from './health/nabiz.js';

// Command palette (Hızlı Palet)
export { CommandRegistry } from './commands/palet.js';
export type { JahCommand } from './commands/palet.js';

// Giveaway (Kısmet)
export { KismetService, createCryptoRng } from './giveaway/kismet.js';
export type { KismetEntry, KismetOptions, KismetSnapshot } from './giveaway/kismet.js';

// Audio mixer (Ses Masası)
export { SesMasasiService } from './audio/sesmasasi.js';
export type { DuckOptions, SesMasasiState, SetTabVolumeOptions } from './audio/sesmasasi.js';

// Broadcast cockpit (Yayın Modu / Kalkan / Çentik)
export { BroadcastModeService } from './broadcast/mode.js';
export { KalkanService } from './broadcast/kalkan.js';
export type { KalkanHotkeys } from './broadcast/kalkan.js';
export { CentikService } from './markers/centik.js';
export type { Centik } from './markers/centik.js';
