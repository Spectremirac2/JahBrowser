# JahBrowser Faz 1 — Chromium kabuk yamaları

Bu klasör, JahBrowser'ı stok Chromium'dan ayıran fork değişikliklerini içerir.

## `jah-browser-faz1.patch` (yetkili artefakt)

Chromium ağacından `git diff` ile üretilmiş **sadık** yama. 47 dosya, şunları kapsar (Chromium fork base commit: `47280b64e3`; build-env `.tlb`/dxil değişiklikleri hariç):

- **Marka** (branding): `BRANDING`, `chromium_strings.grd`, `chromium_strings_tr.xtb` (Türkçe ekler), `chromium_install_modes.h` → ürün adı "JahBrowser", TR pencere başlığı, `%LOCALAPPDATA%\JahBrowser` profili
- **Jah teması** (layer 1): `jah_theme_color_mixer.{cc,h}` + color pipeline wiring + `theme_service.cc` (varsayılan kDark) → koyu Jah kabuk (frame/toolbar/tab/omnibox), neon yeşil focus vurgusu
- **Özel Yeni Sekme** (layer 2): `jah_home/` WebUI (`chrome://jah-home`) + `search.cc` yönlendirmesi + `webui_url_constants.h` / `chrome_web_ui_configs.cc` / `webui/BUILD.gn` kayıtları → her yeni sekme = JahBrowser ana sayfası
- **ON AIR göstergesi** (layer 3): `jah_on_air_view.{cc,h}` + `toolbar_view.{cc,h}` + `pref_names.h` / `browser_ui_prefs.cc` (`prefs::kJahBroadcastMode`) → Yayın Modu açıkken araç çubuğunda kırmızı ON AIR pill
- **Kick Side Panel** (layer 4): `webui/side_panel/jah_live/` (raw-string WebUI, grit YOK — jah_home tekniği) + `views/side_panel/jah_live/` (coordinator + web_view) + `SidePanelEntry::Id::kJahLive` kaydı (`side_panel_entry_id.h`, `side_panel_helper.cc`, `browser_window_features.{h,cc}`, `browser_actions.cc` pinnable action, `chrome_action_id.h`) + zorunlu allow-list'ler (`page`/`ui`/`browser` histograms.xml `IsValidWebUIName`/`SidePanelEntry` senkronu, `actions.xml`) + `IDS_JAH_LIVE_TITLE` "Yayınlar" → yan panelde Kick canlı sidebar (chrome://jah-live-side-panel.top-chrome)
- **Gerçek Kick canlı verisi** (layer 5): `jah_home_ui.cc` + `jah_live_ui.cc` browser-process `SimpleURLLoader` ile `kick.com/api/v2/channels/{slug}` çekiyor (CORS yok; Chromium TLS parmak izi Cloudflare'ı geçiyor — probe ile doğrulandı). Hero (Jahrein) + 6 takip kanalı paralel (barrier), `__JAH_*__`/`__JAH_FOLLOWS__` placeholder enjeksiyonu, XSS-güvenli, graceful fallback. NTP hem hero hem takip listesinde, side panel hem hero hem kanal listesinde gerçek veri.

**Not (fork yapısı):** Bu değişiklikler Chromium ağacında da iki commit olarak duruyor (`a916d44` + `5fe0f4c`, base `47280b64e3` üzerinde) — fork'un doğal yapısı. Patch bu commit'lerden `git diff` ile üretildi.

### Uygulama (temiz Chromium checkout'una)

```bash
cd E:/src/chromium/src
git apply --3way ../../../JahBrowser/chromium-patches/faz1/jah-browser-faz1.patch
autoninja -C out/Default chrome
```

Rebase sonrası: `git apply` çakışırsa `--3way` çoğu çakışmayı çözer; kalan hunk'ları elle uygula. Yama üretmek için: bkz. üstteki `git diff` akışı.

## Hariç tutulanlar (build-ortamı fix'leri, JahBrowser özelliği değil)

Bunlar `jah-browser-faz1.patch`'e **dahil değil** (yerel SDK/toolchain'e özgü, CLAUDE.md'de belgeli):
- midl `.tlb` rebaseline dosyaları (SDK sürüm uyumsuzluğu)
- `third_party/dawn/.../directx-shader-compiler/BUILD.gn` dxil.dll yol düzeltmesi (yeni SDK)

## Ek dosyalar

- `apply_jah_theme.py` — yalnız tema katmanı için idempotent applier (patch'e alternatif, tema-only iterasyon için)
- `tree-files/` — yeni kaynak dosyaların repo kopyaları (referans/yedek)

## Notlar

- Grit-tabanlı eski side panel dosyaları (`chrome/browser/resources/side_panel/jah_live/`) **kullanılmıyor** (raw-string yaklaşımına geçildi); yamaya dahil değil, ağaçta referanssız durur.
- Side panel içeriği v1 mock; gerçek Kick verisi (jah-core canlı-durum servisi + Kick public API) sonraki adım.
