# JahBrowser — Changelog

Bu dosya JahBrowser'ın gözle görülür değişikliklerini tutar. Biçim [Keep a Changelog](https://keepachangelog.com/tr/) esinli; sürümler [SemVer](https://semver.org/lang/tr/) hedefli (henüz 0.x, sürüm etiketleri Faz 2'de). Tarihler `YYYY-MM-DD`.

Kod/commit dili İngilizce; bu changelog kullanıcı-görünür olduğu için Türkçe (teknik terimler English kalır).

## [Yayınlanmadı]

### Eklendi
- **Jah Araçları (Yeni Sekme)** — ana sayfada, karşılama kartının hemen altında 4 büyük buton: Kontrol Merkezi, Çoklu Yayın, Özellikler, Tanıtım & Rehber. Artık hiçbir özelliğe ulaşmak için adres yazmak gerekmiyor; her yeni sekmede görünür.
- **Ayarlar'a "Jahrein" girişi** — tarayıcının kendi `chrome://settings` sayfasının sol menüsünün en üstünde **Jahrein — Kontrol Merkezi** bağlantısı; bildiğin ayarlar sayfasından tüm Jah özelliklerine tek tıkla.
- **Kick Moderasyon Araçları** (🛡️ Kick sohbetinde, ⚙ butonunun yanında) — **Sohbetçiler** paneli (kim yazdı, kaç mesaj, ne zaman + kullanıcıya tıkla → son mesajları) + **Bayraklar** (şüpheli link, spam/flood, aşırı @bahsetme, bağırma-CAPS yakalar; mesaja rozet koyar + kaydeder). Tamamen cihazda, giriş gerektirmez.
- **Reklam Engelleyici v2 (Balta)** — 140 elle-domain yerine **~93.000 gerçek EasyList + EasyPrivacy** reklam/izleyici domaini + **cosmetic filtreleme** (boş reklam kutularını gizler) + **YouTube reklam atlama** (YouTube reklamları video ile aynı kaynaktan geldiği için domain-engelleme yetmiyordu). Kick/Twitch/emote asla engellenmez.
- **Canlı Altyazı** — Kontrol Merkezi › Medya & Yayın'dan aç; herhangi bir yayın/videoya cihaz-üstü otomatik altyazı (Türkçe destekli, sessiz izleme + yabancı yayın).
- **Ses dengeleme (loudness)** — ses popup'ında Sustur yanında; patlayan alert'ler ile kısık konuşmayı yakınlaştırır (gece kulağa iyi gelir).
- **Kaldığın yerden devam et** — Kontrol Merkezi › Performans'tan; açılışta son sekme ve pencereleri geri yükler.
- **Orta-tık otokaydırma** — uzun VOD yorumları / sohbet logları için tek-elle sürekli kaydırma.
- **Emote autocomplete picker** — Kick chat kutusuna emote adının başını yazınca (≥2 harf) 7TV+BTTV önerileri açılır; ↑/↓ gez, Tab/Enter tamamla, Esc kapat, tıkla ekle. Hem textarea hem contenteditable input'la çalışır.
- **Adres çubuğu arama kısayolları** — `kick`, `yt`, `tw`, `gh`, `wiki` anahtar kelimeleriyle doğrudan Kick/YouTube/Twitch/GitHub/Vikipedi araması (hazır gelir).
- **Koyu Mod (force dark)** — app-menüden tek tıkla tüm siteleri koyu temaya zorlama (gece izleme).
- **JahBrowser Kontrol Merkezi** (`chrome://jah-settings`) — markalı özel ayar sayfası: Yayın Modu/Koyu Mod toggle'ları, Balta sayacı, **Güvenli DNS** sağlayıcı seçici (Cloudflare/Google/Quad9/AdGuard), arama kısayolları.
- **İngilizce dil seçeneği** — özel Jah sayfaları (yeni sekme, Kontrol Merkezi, karşılama) artık iki dilli (TR varsayılan, EN); Kontrol Merkezi'nde **Dil / Language** switcher. Chromium arayüzü zaten tüm dillere geçebiliyordu.
- **Ses Yükseltici (Volume Booster)** — sekme sesini %0-500 arası (WebAudio); `Alt+Shift+↑/↓/0` + ekran göstergesi. Her sayfada çalışır (DRM'li canlı yayınlar hariç).
- **Çoklu Yayın (Multistream)** (`chrome://jah-multi`) — birden fazla Kick yayınını tek ekranda grid'de izleme; takip kanalları + kanal ekle/çıkar + 2/3/4 sütun düzen + hücre başına ses.
- **Sohbet konforu** — Kick sohbetinde anahtar kelime vurgusu + bahsedilme sesi/bildirimi; ⚙ Sohbet paneliyle ayarlanır.
- **Otomatik çökme kurtarma** — sekme işlemi çökerse "Aw Snap" yerine sayfayı otomatik yeniden yükler (yayın sekmeleri en hızlı; döngü-çökmede backoff). Chrome'da yok.
- **Bellek Tasarrufu varsayılan açık** — arka plan sekmeleri RAM'i geri kazanır; yayın sekmesi asla boşaltılmaz.
- **Emote menüsü** — Kick sohbetinde 😀 butonu → 7TV+BTTV emote ızgarası, tıkla-ekle.
- **Mesaj geçmişi** — sohbet kutusunda ↑/↓ ile gönderilen mesajları geri çağırma (terminal gibi).
- **Kontrol Merkezi'nde Performans bölümü** — Bellek Tasarrufu toggle'ı (kullanıcı kontrolü) + "Çökme kurtarma AKTİF" durumu.
- **Sohbet zaman damgası** — ⚙ Sohbet panelinden açılınca her mesaja saat (SS:DD) eklenir.
- **Emote menüsü arama** — 😀 panelinde emote'ları isme göre filtreleme kutusu.
- **İskelet redesign (devam ediyor)** — özgün UI, onaylanan v3 marka tasarımı (taçlı-J + lacivert + yeşil/cyan + blueprint):
  - **Faz 1 ✓** marka lacivert paleti (`jah_theme_color_mixer.cc`) + **aktif sekme yeşil alt-çizgisi** (tab paint). Ekran görüntüsüyle doğrulandı.
  - **Faz 2 ✓** side panel **sola** alındı (native resize/gizle) + jah-live "Yayınlar" paneli navy'ye rebrand + **Araçlar** bölümü (Çoklu Yayın/Balta/Kontrol Merkezi/Ana Sayfa) + panel toolbar'a **varsayılan pinli** (tek-tık sol hub).
  - **Faz 3 ✓** gerçek **taçlı-J marka logosu** yeni sekme (NTP masthead) + hub paneli + Kontrol Merkezi + Çoklu Yayın'a gömüldü; tüm Jah sayfaları navy palete çekildi. **7/7 fonksiyonel smoke test geçti** (NTP+logo, navigasyon, jah-settings, jah-multi, kick emote, yeni sekme, çökme yok).
  - **Faz 4 ✓ (kritik)** **Sol Jah hub yan barı artık VARSAYILAN AÇIK** — kök neden bulundu+düzeltildi (JahLive WebUI availability gate) + auto-open (`kJahLivePanelOpenByDefault`); tarayıcı artık Chrome'a hiç benzemiyor. **Sağ üst Balta butonu** (aç/kapa, yeşil/gri). **Tüm AI özellikleri KALDIRILDI** (Gemini/GLIC, omnibox AI Modu, Lens, model execution+indirme, Compose, sayfa analizi). **Hız flag'leri** (threaded preload/body, font ön-yükleme, spare renderer). Özellik **aç/kapa toggle'ları** (Balta/emote/ses) Kontrol Merkezi'nde.
  - **Faz 5 ✓ (popup panel'ler)** **uBlock tarzı Balta popup** — Balta ikonuna tıkla → büyük güç butonu (aç/kapa) + engel sayacı + kırmızı/yeşil oran barı (WebUI bubble). **Ses kontrolü popup** — yanındaki ses ikonuna tıkla → %0-500 slider + preset (100/200/300/500) + sustur; aktif sekmenin sesini kontrol eder. İki popup da aktif siteyi (domain) gösterir (uBlock gibi). İkisi de canlı doğrulandı.
  - **Faz 5 ✓ (hub fonksiyonel + fix'ler)** Sol Jah hub yan barındaki **Araçlar butonları** (Çoklu Yayın/Balta/Kontrol Merkezi/Ana Sayfa) + **kanal satırları + hero** artık tıklanınca ilgili sayfayı/kanalı açıyor (eskiden window.open side panel'de blokluydu). **Pre-existing bug FIX:** hub takip listesi placeholder'ı yanlış doldurulup panel boş/mock gösteriyordu; artık gerçek takip kanalları + avatarlar render oluyor. **Görünüm > Yan bar** toggle'ı Kontrol Merkezi'nde.
- **Kullanım dokümanları** (`docs/kullanim/`) — her özelliğin ayrı Türkçe kullanım kılavuzu.

### Kalan / planlanan (tam liste: `research/_sentez/kalan-isler.md`)
- **Dış girdi:** kod imzalama (#14, OV sertifikası); Kick OAuth özellikleri (sohbete yazma/moderasyon — credential'lar hazır)
- **Native HLS gerektirir:** yayın kalitesi seçici; anlık klip (son 30-60sn buffer)
- **Non-HLS polish:** Kick chat timestamp / oto-kaydırma duraklatma / kullanıcı kartları · emote menüsü arama · GPU-crash yayın reload · markalı hata sayfaları · okuma modu · tema aksan rengi
- **Faz 2:** OBS-websocket · auto-update · installer
- **Düşürüldü:** Twitch chat emote (proje sahibi, 2026-07-06)

---

## 2026-07-05 — Faz 1 (temel özellikler)

Chromium 152 fork hattı; upstream base `47280b64e3` üstünde temiz commit dizisi. Patch: `chromium-patches/faz1/jah-browser-faz1.patch`.

### Eklendi
- **Jah teması** — koyu zemin + neon yeşil (#53FC18) aksan; Chrome'a benzemeyen barlar/sekmeler.
- **Türkçe-first UI** — İ/ı harf dönüşümüne dikkat eden yerelleştirme.
- **Özel yeni sekme** (`chrome://jah-home`) — saat, kişisel selamlama, canlı yayın akışı.
- **Gerçek canlı Kick verisi + avatarlar** — browser-process fetch (Cloudflare bypass).
- **Kişiselleştirilebilir giriş ekranı** — kullanıcı-düzenlenebilir takip listesi (pref `kJahFollowChannels` + `chrome.send` paneli), varsayılan 5 kanal (jahrein + swaggybark, burhi, caglararts, buraksakinol); selamlama adı + hızlı-erişim kısayolu düzenleme.
- **Birleşik Kick + Twitch** — Twitch public web GQL ile credential'sız canlı durum; avatar proxy.
- **Kick canlı yan panel** (`jah-live`, "Yayınlar").
- **Go-live bildirimi** — takip kanalları yayın açınca Windows toast'ı (7 kanal yoklanır).
- **Native emote injection** — RenderFrameObserver kick.com/twitch.tv'ye izole-dünya content-script enjekte eder; **7TV** (kanal + global) ve **BTTV** global emote'ları chat'te yerleşik render. (Anahtar: `DidFinishLoad` zamanı + izole dünyaya boş CSP.)
- **Balta adblock** — renderer `URLLoaderThrottle` + curated ~130-domain blocklist; whitelist-önce (kick/twitch/7tv/bttv asla engellenmez). **Gerçek günlük sayaç**: mojo → `local_state` → NTP.
- **ON AIR göstergesi** — yayın modunda kırmızı pill (Ctrl+Shift+Y + app-menü).
- **Onboarding** (`jah-onboarding`, first-run otomatik) + **Chrome'dan içe aktarma**.
- **Yayın sekmesi keep-alive** — Kick/Twitch sekmesi asla discard/freeze edilmez.

### Doğrulandı (upstream'de mevcut, yeni kod gerekmedi)
- **Split view** (yan yana sekme) — Chromium 152'de enabled.
- **Document / video PiP** — Chromium 152'de mevcut.
- **DoH** — varsayılan "automatic".

## 2026-07-05 — Faz 0 (fork doğrulama)
### Eklendi
- Chromium 152 tam build (~4.7 saat) + branding patch → "JahBrowser" binary (ProductName, TR pencere başlığı, kendi profil dizini).
- H.264/AAC codec zinciri (proprietary_codecs) — kick.com video oynatma görsel teyit.
- `jah-core` — motor-bağımsız TypeScript çekirdek: 12 modül, 142 test.
- 90+ dokümanlık araştırma arşivi (`research/`).
