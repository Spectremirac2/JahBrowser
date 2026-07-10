<div align="center">

# JahBrowser

**Kick izleyicileri ve yayıncıları için doğuştan optimize, çökmeyen Chromium tarayıcısı.**

[![Lisans](https://img.shields.io/badge/lisans-BSD--3--Clause-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0A0E13.svg)]()
[![Chromium](https://img.shields.io/badge/temel-Chromium%20152-2ecc71.svg)]()

### [![JahBrowser'ı Windows için indir](https://img.shields.io/badge/⬇%20İndir-JahBrowser%20(Windows)-2ecc71?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Spectremirac2/JahBrowser/releases/latest/download/JahBrowser-Setup.exe)

**En güncel sürüm** · Windows 10/11 · [Taşınabilir (.zip)](https://github.com/Spectremirac2/JahBrowser/releases/latest/download/JahBrowser-Portable.zip) · [Tüm sürümler](../../releases/latest)

[**Neden çökmüyor?**](#-neden-çökmüyor) · [**Özellikler**](#-özellikler) · [**Derle**](#-kaynaktan-derleme) · [**Güvenlik**](SECURITY.md)

[**English**](README.md) · **Türkçe**

<img src="docs/screenshots/01-new-tab.png" alt="JahBrowser yeni sekme" width="90%">

</div>

---

## Nedir?

JahBrowser, **Kick** izleyicileri ve yayıncıları için tasarlanmış, Chromium 152 tabanlı açık kaynak bir Windows tarayıcısıdır. Chrome kadar tanıdık; ama canlı yayın izlemek için doğuştan optimize — ve **bir çökme yayınınızı asla kesmeyecek** şekilde tasarlandı.

- **Çökmez** — bir sekme çökse bile yayınınız kesilmez (aşağıda anlatılıyor).
- **Eklentisiz emote motoru** — 7TV / BTTV / FFZ / Kick emote'ları chat'te doğrudan render.
- **Motor seviyesinde reklam engelleme (Balta)** — ~93.000 reklam/tracker domaini + YouTube ad‑skip + kozmetik filtre.
- **Canlı yan panel** — takip ettiğin Kick kanalları tek yerde, gerçek canlı veriyle.
- **Site‑başına ses booster** (%0–500) + loudness dengeleme, çoklu yayın, yayıncı modu, native Kick mod araçları.

<div align="center">
<img src="docs/screenshots/02-control-center.png" alt="Kontrol Merkezi" width="49%">
<img src="docs/screenshots/03-multistream.png" alt="Çoklu Yayın" width="49%">
</div>

---

## 🛡️ Neden çökmüyor?

Bu, JahBrowser'ın en önemli farkı. Kısa cevap: **Chromium'un kaya gibi çok‑işlemli çekirdeğini aynen kullanıyoruz, üstüne bir "kurtarma + koruma" katmanı ekliyoruz** — böylece bir çökme yayınınızı hiç kesmez.

Chrome de aslında sağlamdır; ama bir sekmenin işlemi çöktüğünde sana **"Hay aksi! / Aw, Snap!"** hata sayfasını gösterir ve **elle yenilemeni** bekler. Arka plandaki sekmeyi de bellek baskısı altında **uykuya alır/boşaltır**, geri döndüğünde baştan yükler. JahBrowser bu iki davranışı da değiştirir. İşte tam olarak nasıl:

### 1. Otomatik çökme kurtarma (görünmez)
Bir sekmenin render işlemi gerçekten çökerse, JahBrowser hata sayfasını göstermek yerine sekmeyi **taze bir işlemde otomatik yeniden yükler** — çoğu zaman sen fark etmeden sayfa geri gelir.

- **Yayın sekmeleri (kick.com) en hızlı kurtulur (~50 ms);** diğer sekmeler ~400 ms.
- **Sadece gerçek çökmeler** kurtarılır (işlem çökmesi, bellek yetersizliği, bütünlük hatası). Kapattığın ya da bellek tasarrufu için boşaltılan sekmeler yanlışlıkla yeniden yüklenmez.
- **Sonsuz döngü koruması:** bir sayfa gerçekten bozuksa (üst üste çökerse), kurtarma kademeli yavaşlar (1 sn → 3 sn → 10 sn) ve bir eşikten sonra durur; o zaman normal hata sayfası gösterilir. Böylece bozuk bir site tarayıcıyı kilitlemez.
- **Form güvenliği:** POST (form gönderimi) sonrası sayfalar otomatik yenilenmez — verini sessizce ikinci kez göndermeyiz.

*(Kod: `chrome/browser/jah/jah_crash_recovery_tab_helper.cc` — `WebContentsObserver::PrimaryMainFrameRenderProcessGone` üstüne kurulu, [`chromium-patches/`](chromium-patches/) içinde.)*

### 2. Yayın sekmesi asla uyutulmaz
Chrome dahil çoğu tarayıcı, RAM kazanmak için arka plandaki sekmeleri **dondurur/boşaltır** — bu, yayını arka planda dinlerken sesin kesilmesine ya da sekmeye dönünce yeniden yüklenmesine yol açar.

JahBrowser'da **kick.com sekmeleri hiçbir zaman boşaltılmaz/dondurulmaz** (Chromium'un discard/freeze motoruna `kJahStreamSite` gerekçesi eklendi). Bellek Tasarrufu (Memory Saver) varsayılan **açık** — ama yalnızca yayın‑dışı sekmelere uygulanır. Sonuç: kaç sekme açarsan aç, yayın arka planda kesintisiz devam eder.

### 3. Video kararmaz
Donanım (GPU) video çözücüsü bir sürücü hatasıyla düşerse, video **kararmak yerine yazılım çözücüye inip oynamaya devam eder** (`proprietary_codecs` + `ffmpeg_branding="Chrome"` birlikte derlenir). GPU işlemi çökerse Chromium'un yerleşik güvenlik merdiveni devreye girer — **tüm tarayıcı değil, sadece GPU katmanı** daha güvenli moda iner. Bu merdiveni bozan riskli bayraklar (`--ignore-gpu-blocklist`, `--disable-gpu-watchdog` vb.) hiçbir zaman gönderilmez.

### 4. Kendi hatalarımızı da temizledik
Geliştirme sırasında reklam‑engelleyici katmanımızın (Balta) belirli sayfalarda render işlemini öldüren bir hatası vardı; kök nedeni bulunup düzeltildi. "Her şey çöküyor" şikayetinin asıl kaynağı buydu ve artık yok.

**Özet:** Aynı Chromium sağlamlığı + görünmez otomatik kurtarma + yayın sekmesi koruması + korunmuş GPU merdiveni = izleyici için **kesintisiz yayın.**

---

## ✨ Özellikler

| Alan | Özellik |
|---|---|
| **Stabilite** | Otomatik çökme kurtarma · yayın sekmesi keep‑alive · video yazılım‑fallback · oturum geri‑yükleme |
| **Yayın** | Canlı yan panel (gerçek Kick verisi + avatarlar) · çoklu yayın grid'i · go‑live masaüstü bildirimi · Tiyatro (tam ekran) modu |
| **Chat / Emote** | Eklentisiz 7TV/BTTV/FFZ/Kick emote render · emote picker + menü · keyword highlight + mention sesi · mesaj geçmişi |
| **Kick Mod araçları** | Native mod paneli (sohbetçi kadrosu + user‑card · link/spam/flood/CAPS bayrakları · silme tespiti) — %100 client‑side |
| **Reklam / Gizlilik** | Balta adblock (~93k domain + kozmetik + YouTube ad‑skip) · DoH açık · telemetri opt‑in |
| **Ses** | Site‑başına ses booster %0–500 · loudness/normalize · ses mikseri popup'ı |
| **Kişiselleştirme** | Özel yeni sekme (canlı Kick verisi) · düzenlenebilir takip listesi · koyu mod · arama kısayolları · iki dilli (TR/EN) |

Ayrıntılı kullanım kılavuzları: [`docs/kullanim/`](docs/kullanim/)

---

## ⬇️ İndirme ve doğrulama

1. [**Releases**](../../releases/latest) sayfasından `JahBrowser-Setup.exe` (kurulum) veya `JahBrowser-Portable.zip` (taşınabilir — çıkar, `JahBrowser.bat` ile çalıştır) indir.
2. Tarayıcı **varsayılan İngilizce açılır**; Kontrol Merkezi'nden Türkçe'ye geçebilirsin.

### "Windows bilgisayarınızı korudu" uyarısı görürsen
JahBrowser **açık kaynak** ve şu an **imzasız** bağımsız bir yapımdır. Windows SmartScreen, henüz "itibar" kazanmamış **her** yeni imzasız programa bu uyarıyı gösterir — **virüs olduğu anlamına gelmez.** Devam etmek için: **"Ek bilgi" → "Yine de çalıştır"**.

Güvenmek zorunda değilsin — **doğrula:**
- Her sürümde yayınlanan **`SHA256SUMS.txt`** ile indirdiğin dosyanın bütünlüğünü kontrol edebilirsin (PowerShell: `Get-FileHash .\JahBrowser-Setup.exe`).
- **VirusTotal taraması (temiz):** [canlı raporu gör ✅](https://www.virustotal.com/gui/url/29779ddaf5f1ef2a94b43d75a85e59a14bfde9501588b15b2670528b33ecdde7/gti-summary) — her sürüm ayrıca dosya hash'iyle taranır (linkler release notunda).
- Tüm kaynak kod bu depoda — istersen [kendin derleyip](#-kaynaktan-derleme) çalıştırırsın.

Ayrıntı: [SECURITY.md](SECURITY.md)

---

## 🔧 Kaynaktan derleme

JahBrowser, Chromium'un tamamını yeniden dağıtmaz. Bunun yerine [ungoogled‑chromium](https://github.com/ungoogled-software/ungoogled-chromium) modelini izler: **temiz bir Chromium ağacının üstüne uygulanan yamalar.**

```
chromium-patches/
  faz1/
    jah-browser-faz1.patch          # ana değişiklik seti (~94 dosya)
    search-engines-submodule.patch  # arama motoru verisi (ayrı submodule)
    jah-release-args.gn             # dağıtım build args şablonu
    tree-files/                     # patch'e giren yeni tam dosyalar
```

Özet (ayrıntı için `chromium-patches/README.md`):

1. Chromium 152 kaynak ağacını checkout et (base commit `47280b64e3`), `depot_tools` kur.
2. Yamaları uygula: `git apply chromium-patches/faz1/jah-browser-faz1.patch`
3. `jah-release-args.gn` şablonundan `out/Release/args.gn` oluştur. **Kritik:** dağıtım build'i için `proprietary_codecs=true` **ve** `ffmpeg_branding="Chrome"` birlikte olmalı (video stabilitesi için).
4. `gn gen out/Release && autoninja -C out/Release chrome mini_installer`

`jah-core/` (motor‑bağımsız ürün mantığı, TypeScript) bağımsız test edilebilir: `cd jah-core && npm install && npm test`.

---

## 🔒 Gizlilik

- **Telemetri varsayılan kapalı** (opt‑in).
- **DoH (DNS‑over‑HTTPS) açık.**
- Yayıncı gizlilik modu: "bu ekran yayında görünürse ne sızar?" sorusu gözetilerek tasarlandı.
- Google hesabı senkronizasyonu gibi bazı Google servisleri, açık kaynak yapımlarda API anahtarı olmadan çalışmayabilir (Chromium'un bilinen davranışı).

---

## 📄 Lisans ve marka

- Kod: **BSD 3‑Clause** — bkz. [LICENSE](LICENSE). Chromium ve türev bileşenler kendi lisansları altındadır.
- Bu proje **bağımsız bir topluluk projesidir**; Google, Kick, 7TV, BTTV veya FrankerFaceZ ile resmi bir bağı yoktur. Tüm marka ve logolar sahiplerine aittir.
- "Chrome" adı/logosu **kullanılmaz** (Google ticari markası).

---

<div align="center">
<sub>Kick topluluğu için ❤️ ile · <a href="README.md">English README</a></sub>
</div>
