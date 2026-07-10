<div align="center">

# JahBrowser

**Kick izleyicileri ve yayıncıları için doğuştan optimize — normal Chrome'dan hızlı ve çökmeyen Chromium tarayıcısı.**

[![Lisans](https://img.shields.io/badge/lisans-BSD--3--Clause-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0A0E13.svg)]()
[![Chromium](https://img.shields.io/badge/temel-Chromium%20152-2ecc71.svg)]()

### [![JahBrowser'ı Windows için indir](https://img.shields.io/badge/⬇%20İndir-JahBrowser%20(Windows)-2ecc71?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Spectremirac2/JahBrowser/releases/latest/download/JahBrowser-Setup.exe)

**En güncel sürüm** · Windows 10/11 · [Tüm sürümler](../../releases/latest)

[**Neden çökmez?**](#-neden-çökmez-kapanmaz) · [**Neden hızlı?**](#-neden-hızlı) · [**Özellikler**](#-özellikler) · [**Derle**](#-kaynaktan-derleme) · [**Güvenlik**](SECURITY.md)

[**English**](README.md) · **Türkçe**

<img src="docs/screenshots/01-new-tab.png" alt="JahBrowser yeni sekme" width="90%">

</div>

---

## Nedir?

JahBrowser, **Kick** izleyicileri ve yayıncıları için tasarlanmış, Chromium 152 tabanlı açık kaynak bir Windows tarayıcısıdır. Chrome kadar tanıdık; ama canlı yayın izlemek için doğuştan optimize — **düz bir Chromium'dan daha hızlı ve akıcı**, ve **bir çökme yayınınızı asla kesmeyecek** şekilde tasarlandı.

- **Hızlı ve akıcı** — anında yeni sekme, anında sekme geçişi, AI şişkinliği yok (aşağıda anlatılıyor).
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

## 🛡️ Neden çökmez, kapanmaz?

Bu, JahBrowser'ın en önemli farkı. Kısa cevap: **Chromium'un kaya gibi çekirdeğini aynen kullanıyoruz, üstüne tüm‑tarayıcı bir "kurtarma + koruma" katmanı ekliyoruz** — böylece hiçbir şey yayınını kesmez; bir şey ölse bile saniyede geri gelir.

Aslında burada **iki ayrı sorun** var ve çoğu "çökme kurtarma" sadece birincisini çözer:

- **Tek bir sekme çöker** → klasik **"Hay aksi! / Aw, Snap!"** sayfası.
- **Tüm tarayıcı donar, kendini kapatır veya kaybolur** → her şey gider. Uzun yayında asıl canını yakan bu, ve çoğu araç bunu görmezden gelir.

JahBrowser ikisini de çözer. İşte her gerçek sorun ve tam olarak nasıl çözüldüğü:

### Sorun: bir sekme çöker ("Hay aksi!")
**Çözüm — görünmez sekme kurtarma.** Bir sekmenin render işlemi çökerse, JahBrowser hata sayfası göstermek yerine sekmeyi **taze bir işlemde otomatik yeniden yükler** — çoğu zaman sen fark etmeden geri gelir.
- **Yayın sekmeleri (kick.com) en hızlı kurtulur (~50 ms);** diğerleri ~400 ms.
- **Sadece gerçek çökmeler** kurtarılır; kapattığın veya bellek için boşaltılan sekmeler yanlışlıkla yeniden yüklenmez.
- **Sonsuz döngü koruması:** üst üste çöken sayfa kademeli yavaşlar (1 sn → 3 sn → 10 sn) ve sonunda hata sayfası gösterilir — bozuk site tarayıcıyı kilitleyemez.
- **Form güvenliği:** POST sayfaları sessizce ikinci kez gönderilmez.

### Sorun: tüm tarayıcı çöker veya kendini kapatır
**Çözüm — otomatik yeniden başlatma + oturum kurtarma.** *Tüm* tarayıcı süreci ölünce JahBrowser Windows'a **kendini yeniden başlatmasını ve son sekmelerini açmasını** söyler (`--restore-last-session`). Çoğu zaman saniyeler içinde yayınınla birlikte dönersin. Yerleşik bir koruma (Windows 60 sn'den kısa çalışan uygulamayı yeniden başlatmaz) açılış‑çökmesi döngüsünü engeller.

### Sorun: tarayıcı donar / yanıt vermez
**Çözüm — aynı yeniden başlatma yolu donmayı da kapsar.** UI iş parçacığı donup Windows "yanıt vermiyor" penceresini kapatırsa, tarayıcı yine önceki oturumuna geri açılır. Açık sekmelerin sürekli kaydedilir, neredeyse hiçbir şey kaybolmaz.

### Sorun: video donar veya kararır (GPU / sürücü)
İzlerken donmanın **1 numaralı** sebebi — sorunlu ekran kartı sürücüsü. **Çözüm, üç katman:**
1. **Yazılım fallback** — donanım video çözücüsü düşerse video **kararmak yerine yazılım çözücüye inip oynamaya devam eder** (`proprietary_codecs` + `ffmpeg_branding="Chrome"` birlikte derlenir).
2. **Kendini iyileştiren güvenli‑GPU merdiveni** — GPU tekrar tekrar çökerse JahBrowser bunu **o makineye özel hatırlar** ve sonraki açılışta kademeli güvenli video yoluna geçer (DirectComposition kapalı → donanım video çözme kapalı). Sürücün düzelince kademeli olarak tam hızlandırmaya döner.
3. **Tek‑tık Güvenli Video Modu** — Kontrol Merkezi'nde; video sorun çıkarırsa güvenli yolu anında zorlar.

Chromium'un GPU güvenlik merdivenini **bozan** riskli bayraklar (`--ignore-gpu-blocklist`, `--disable-gpu-watchdog` …) **hiçbir zaman** gönderilmez.

### Sorun: uzun oturumlar tüm RAM'i yer (bellek tükenmesi)
**Çözüm — yayını koruyan bellek yönetimi.** Saatlerce açık oturumlar için **Uzun Yayın Modu** belleği agresif yönetir; boşta duran arka plan sekmeleri RAM'ini boşaltır — ama **yayın sekmeleri (kick.com) asla boşaltılmaz/dondurulmaz** (`kJahStreamSite`). Kaç sekme açarsan aç, yayın oynamaya devam eder. (Günlük kullanımda tarayıcı tüm sekmeleri canlı tutar, aralarında geçiş anlıktır.)

### Bonus: çökmelerden öğrenir
**İsteğe bağlı, yalnızca yerel** bir çökme günlüğü (varsayılan kapalı, KVKK‑dostu, hiçbir şey gönderilmez) çökmenin ardındaki GPU/sürücüyü kaydeder; böylece donmaya yol açan donanım kombinasyonları gerçekten çözülebilir.

**Özet:** Aynı Chromium sağlamlığı + görünmez sekme kurtarma + tüm‑tarayıcı otomatik yeniden başlatma + kendini iyileştiren GPU yolu + yayın‑korumalı bellek = **yayının hiç kesilmez, tarayıcı ölse bile hemen geri gelir.**

> **Dürüst not:** Bu donmaların çoğunun kaynağı senin GPU sürücün / donanımın / Windows'un — hiçbir tarayıcı bozuk bir sürücünün hata yapmasını *engelleyemez*. JahBrowser'ın işi: tetikleyicileri azaltmak, görünmez kurtarmak, ölürse saniyede geri gelmek ve sana kolay kaçış kapıları vermek.

---

## ⚡ Neden hızlı?

Stabilite işin yarısı — JahBrowser aynı zamanda **düz bir Chromium/Chrome'dan daha hızlı ve akıcı** hissettirecek şekilde ayarlandı, özellikle bol RAM'li makinede. Riskli hiçbir şey açık değil; hepsi *daha az iş yapmak* ve *gerekmeyen şeyleri beklememek* üzerine.

- **Anında yeni sekme.** Özel yeni sekme sayfası gerçek canlı Kick verisi gösterir, ama artık sekmeyi network isteklerine bloklamıyor — en yeni veri bellek‑içi cache'ten servis edilir, arka planda tazelenir. Pratikte launch sonrası ilk sekme bir anda dolar, **sonraki her sekme ~15 ms'de** açılır (network beklemek yerine).
- **Anında sekme geçişi.** Yeterli RAM varken boşta sekmeleri bellekten atmanın anlamı yok — JahBrowser onları varsayılan olarak canlı tutar. Arka plan sekmesine dönmek **anında, yeniden yükleme yok**. (Saatlerce süren, düşük‑RAM oturumlar *Uzun Yayın Modu* ile agresif belleğe geçebilir.)
- **AI şişkinliği yok.** Modern Chrome'daki her ağır AI alt sistemi — Gemini/asistan, AI Modu omnibox, Lens overlay, cihaz‑içi model çalıştırma, sayfa‑içeriği etiketleme, Compose — **derlemeden çıkarıldı / devre dışı.** Bu, orada olmayan bir sürü arka plan işi ve bellek demek.
- **Motor seviyesinde reklam engelleme.** Normal gezinmeyi en çok yavaşlatan şey reklamlar ve tracker'lar. ~93.000 reklam/tracker domainini network katmanında engellemek (Balta), sayfaların indirecek, ayrıştıracak ve çalıştıracak çok daha az şeyle yüklenmesi demek.
- **Daha az arka plan yükü.** JahBrowser'ın kendi ekstraları yolda durmaz — ör. ses booster bir sayfayı yalnızca sen kullanınca izlemeye başlar, sıradan gezinme ve scroll ek maliyet taşımaz.
- **Açılış & yükleme ayarı.** Hız odaklı Chromium bayrakları açık (threaded HTML body yükleme, kaynak preload, font‑lookup prefetch, spare‑renderer önceliği) — soğuk açılışlar ve sayfa yüklemeleri sıkı kalır.

Net sonuç: yeni sekmeler ve sekme geçişleri anında hissettirir, yayın sayfaları akıcı kalır, ve CPU ile belleğin için düz bir tarayıcıya göre çok daha az görünmez makine yarışır.

---

## ✨ Özellikler

| Alan | Özellik |
|---|---|
| **Hız** | Anında yeni sekme (cache'li canlı veri, network bloğu yok) · anında sekme geçişi (sekmeler canlı kalır) · AI şişkinliği yok (Gemini/Lens/cihaz‑içi modeller derlemeden çıkarıldı) · motor seviyesinde reklam engelleme · açılış/yükleme bayrak ayarı |
| **Stabilite** | Tüm‑tarayıcı otomatik yeniden başlatma (çökme + donma) · sekme çökme kurtarma · kendini iyileştiren güvenli‑GPU merdiveni + Güvenli Video Modu · yayın sekmesi keep‑alive · Uzun Yayın Modu · opt‑in yerel çökme günlüğü |
| **Yayın** | Canlı yan panel (gerçek Kick verisi + avatarlar) · çoklu yayın grid'i · go‑live masaüstü bildirimi · Tiyatro (tam ekran) modu |
| **Chat / Emote** | Eklentisiz 7TV/BTTV/FFZ/Kick emote render · emote picker + menü · keyword highlight + mention sesi · mesaj geçmişi |
| **Kick Mod araçları** | Native mod paneli (sohbetçi kadrosu + user‑card · link/spam/flood/CAPS bayrakları · silme tespiti) — %100 client‑side |
| **Reklam / Gizlilik** | Balta adblock (~93k domain + kozmetik + YouTube ad‑skip) · DoH açık · telemetri opt‑in |
| **Ses** | Site‑başına ses booster %0–500 · loudness/normalize · ses mikseri popup'ı |
| **Kişiselleştirme** | Özel yeni sekme (canlı Kick verisi) · düzenlenebilir takip listesi · koyu mod · arama kısayolları · iki dilli (TR/EN) |

Ayrıntılı kullanım kılavuzları: [`docs/kullanim/`](docs/kullanim/)

---

## ⬇️ İndirme ve doğrulama

1. [**Releases**](../../releases/latest) sayfasından `JahBrowser-Setup.exe` (kurulum) indir ve çalıştır.
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

- Kod: **BSD 3‑Clause** — bkz. [LICENSE](LICENSE) ve [NOTICE](NOTICE.md). Chromium ve türev bileşenler kendi lisansları altındadır.
- Bu proje **bağımsız bir topluluk projesidir**; Google, Kick, 7TV, BTTV veya FrankerFaceZ ile resmi bir bağı yoktur. Tüm marka ve logolar sahiplerine aittir.
- "Chrome" adı/logosu **kullanılmaz** (Google ticari markası).

---

<div align="center">
<sub>Kick topluluğu için ❤️ ile · <a href="README.md">English README</a></sub>
</div>
