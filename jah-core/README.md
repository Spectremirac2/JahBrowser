# @jahbrowser/jah-core

JahBrowser'ın **motor-bağımsız çekirdeği**. Buradaki kod ne Electron ne Chromium bilir — motora yalnızca `EngineAdapter` arayüzü (`src/engine/types.ts`) üzerinden dokunur. Bu, Electron ↔ Chromium fork geçişinin sigortasıdır (bkz. kök `CLAUDE.md`, bağlayıcı mimari kararlar).

## Yapı

| Modül | Ne |
|---|---|
| `engine/types.ts` | **EngineAdapter sözleşmesi** — tabs, windows (PiP + capture-exclude), net, storage, notifications, global hotkeys (Kalkan/Çentik temeli), broadcast mode (Yayın Modu) |
| `engine/mock.ts` | Bellek-içi mock adaptör — testler motor olmadan koşar |
| `platform/kick/` | Resmi Kick API istemcisi (OAuth 2.1) + Pusher chat fallback (uzaktan güncellenebilir config ile) |
| `platform/twitch/` | Helix istemcisi (EventSub: Faz 1) |
| `emotes/` | Native emote motoru — 7TV/BTTV/FFZ/Kick sağlayıcı arayüzü + mesaj segmentasyonu |
| `live/followed.ts` | Kick+Twitch birleşik canlı durum servisi — sidebar + "yayın açtı" bildiriminin veri katmanı |

## Komutlar

```bash
npm run typecheck   # tsc --noEmit
npm run build       # dist/ üretir
```

## Kurallar

- UI veya motor API'si import etmek **yasak** (lint kuralı CI'a eklenecek).
- Yeni yetenek gerekiyorsa `EngineAdapter`'a dar bir port ekle; motor detayını sızdırma.
- `Ctrl+Alt` kısayol kombinasyonları yasak (TR klavye AltGr çakışması).
