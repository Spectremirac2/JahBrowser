# JahBrowser Branding Patch Kiti (v1 — SADECE ISIM)

`apply_branding.py`, Chromium kaynak agacini (varsayilan: `E:/src/chromium/src`)
**isim duzeyinde** "Chromium" -> "JahBrowser" olarak rebrand eder.
Ikon degisikligi bu surumde YOK (ikinci dalga); `is_chrome_branded=false` ve
gn args aynen kalir, mevcut `out/` dizini incremental ninja ile kullanilir.

Kaynak plan: `research/11-fork-implementasyon/branding-patch-plani.md` (Task 4).

## Ne yapar? (4 dosya)

| Dosya | Degisiklik | Kullaniciya etkisi |
|---|---|---|
| `chrome/app/theme/chromium/BRANDING` | `PRODUCT_FULLNAME/SHORTNAME`, `COMPANY_*`, `PRODUCT_INSTALLER_*` -> JahBrowser (COPYRIGHT ve MAC_* satirlari dokunulmaz) | Task Manager adi, exe Ozellikler > Ayrintilar (ProductName/FileDescription), `PRODUCT_FULLNAME_STRING` makrosu |
| `chrome/app/chromium_strings.grd` | Dosya genelinde `\bChromium\b` -> `JahBrowser` (719 gecis; `IDS_PRODUCT_NAME`, `IDS_SHORT_PRODUCT_NAME`, `IDS_BROWSER_WINDOW_TITLE_FORMAT` dahil). `ChromiumOS` / `ChromiumUpdater` bilesikleri DOKUNULMAZ | Pencere basligi "sayfa - JahBrowser", chrome://version, Ayarlar > Hakkinda (EN locale) |
| `chrome/app/resources/chromium_strings_tr.xtb` | Ayni toplu degisim + Turkce unlu uyumu duzeltmesi: `Chromium'u -> JahBrowser'ı`, `Chromium'un -> JahBrowser'ın`, `Chromium'unuz(u) -> JahBrowser'ınız(ı)`. Diger ekler (`'a`, `'da`, `'daki`, `'dan`, `'la`) genel degisimle dogru kalir | Turkce UI'daki tum marka metinleri (584 gecis) |
| `chrome/install_static/chromium_install_modes.h` | `kProductPathName`, `base_app_name`, `base_app_id` -> `L"JahBrowser"` | User-data dizini `%LOCALAPPDATA%\JahBrowser\User Data` (gercek Chrome/Chromium profilinden tam izolasyon), taskbar/AppUserModelID/toast adi |

Bilerek KAPSAM DISI (v1): ikonlar (`chromium.ico`, `product_logo_*.png`),
`kCurrentProfileIconVersion`, ProgID/CLSID/GUID'ler,
`components/components_chromium_strings.grd` (firewall/engelleme mesajlarindaki
ikincil "Chromium"lar), exe adi (`chrome.exe` kalir — installer zinciri sebebi).

## Kullanim (adim adim)

> Not: `--check` ve `--revert` build surerken guvenlidir; `--apply`'i
> **calisan bir ninja build'i YOKKEN** calistirin (uretilen .rc/.pak
> hedefleriyle yarismasin).

1. **Kontrol (kuru calisma, hicbir sey yazmaz):**
   ```
   python apply_branding.py E:/src/chromium/src --check
   ```
   Tum satirlarda `[ok]` / `[degis]` gormeli, sonunda
   "Tum anchor'lar dogrulandi" demelidir. `[HATA]` varsa (upstream anchor
   degismis demektir) once script'teki anchor'i guncelleyin. Cikis kodu:
   0 = temiz, 1 = anchor hatasi.

2. **Uygula:**
   ```
   python apply_branding.py E:/src/chromium/src --apply
   ```
   - Once otomatik tam kontrol yapar; anchor hatasi varsa HICBIR dosyaya yazmaz.
   - Her degisen dosyanin yanina `.jah.bak` yedegi birakir
     (or. `BRANDING.jah.bak`). Yedek zaten varsa uzerine YAZMAZ — orijinal korunur.
   - Idempotent: ikinci kez calistirmak "degisiklik gerekmiyor" der, zarar vermez.

3. **Build (gn args DEGISMEZ):**
   ```
   autoninja -C out/Default chrome
   ```
   BRANDING her `process_version` hedefinin `sources` listesinde oldugundan
   ninja degisikligi otomatik yakalar; grd/xtb degisimi pak'lari yeniden uretir.

4. **Dogrulama:** pencere basligi "… - JahBrowser"; chrome://version ust satir;
   Ayarlar > Hakkinda; exe Ozellikler > Ayrintilar ProductName=JahBrowser;
   `%LOCALAPPDATA%\JahBrowser\User Data` olustu mu.

5. **Geri alma (gerekirse):**
   ```
   python apply_branding.py E:/src/chromium/src --revert
   ```
   `.jah.bak` yedeklerini geri yukler ve siler. Sonrasinda tekrar
   `autoninja` gerekir.

## Riskler ve notlar

- **Rebase/sync sonrasi yeniden uygulama sart.** `git pull` / `gclient sync`
  patch'li dosyalarin ustune yazar (veya conflict cikarir). Dogru akis:
  `--revert` (veya `git checkout -- <4 dosya>`) -> sync -> `--check` ->
  `--apply`. `chromium_strings.grd` ve `_tr.xtb` upstream'de sik degisir;
  script regex tabanli oldugu icin elle diff'ten dayanikli, ama `--check`
  bir anchor'in kayboldugunu soylerse script guncellenmelidir.
- **.xtb atlanirsa Turkce UI Chromium kalir.** `translateable=true` stringler
  (pencere basligi dahil) TR locale'de grd'den degil `.xtb`'den okunur.
  Bu kit .xtb'yi zorunlu kapsamda tutar; script'i degistirip xtb'yi devre disi
  birakmayin — Jahrein kitlesi TR oldugundan bu en gorunur yuzeydir.
- **Ikincil "Chromium" kacaklari kalir.** `components_chromium_strings.grd`
  (firewall uyarisi, engellenen sayfa vb.) ve diger dillerin .xtb'leri v1
  kapsaminda degil — PoC icin kabul edilmis durum.
- **`base_app_id` degisimi eski taskbar pin'lerini/kisayollari kirar**
  (yeni kimlikle gruplanir). Dev ortamda onemsiz; dagitimda tek seferlik not.
- **User-data dizini degisir:** ilk acilista temiz profil
  (`%LOCALAPPDATA%\JahBrowser\User Data`) olusur; eski Chromium profili
  otomatik tasinmaz. Izolasyon bilincli tercihtir.
- **`is_chrome_branded=true` ASLA acilmamali** — Google-internal kaynak ister,
  build kirilir. Bu kit unbranded dalda kalir, gn arg'a dokunmaz.
- **Turkce dilbilgisi:** unlu uyumu icin 4 ozel ek formu duzeltilir; kalan
  ekler JahBrowser telaffuzuyla ("brau-zir") uyumludur. Ceviri kalitesi
  denetimi (spot check) build sonrasi TR locale'de onerilir.
- **Yedekler agacin icinde durur** (`*.jah.bak`). `git status` bunlari
  untracked gosterir; `gclient sync` sirasinda sorun cikarmazlar ama
  temiz agac isteniyorsa `--revert` sonrasi kalinti kalmaz.

## Cikis kodlari

| Kod | Anlam |
|---|---|
| 0 | Basarili (`--check`: tum anchor'lar dogru) |
| 1 | Anchor/dosya hatasi (`--apply` bu durumda hicbir sey yazmaz) |
