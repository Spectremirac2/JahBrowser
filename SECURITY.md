# Güvenlik ve Doğrulama / Security & Verification

## "Windows bilgisayarınızı korudu" (SmartScreen) uyarısı hakkında

JahBrowser **açık kaynak** ve şu an **kod imzası (code signing) olmayan** bağımsız bir yapımdır.

Windows Defender SmartScreen, henüz yeterince indirilip "itibar" (reputation) kazanmamış **her yeni imzasız programa** bu uyarıyı gösterir. Bu **dosyanın virüs olduğu anlamına gelmez** — yalnızca Windows'un o dosyayı henüz tanımadığı anlamına gelir. Aynı uyarı, imzasız dağıtılan pek çok meşru açık kaynak programda da görülür.

Devam etmek için: **"Ek bilgi" (More info) → "Yine de çalıştır" (Run anyway)**.

> Not: Microsoft, 2024'ten bu yana EV (Extended Validation) sertifikalarının bile SmartScreen'i **anında** geçmesini kaldırdı; itibar artık her sertifika türünde zamanla, indirme hacmiyle oluşuyor. Bu yüzden imza, uyarıyı bir gecede yok etmez.

## Neden imzasız? / Why unsigned?

Kod imzalama sertifikaları ücretli ve kimlik doğrulama gerektirir. Bu topluluk projesi başlangıçta imzasız dağıtılıyor. İmzasız olmak, doğrulanamaz olmak demek değil — **kaynağın tamamı açıktır ve her sürüm için doğrulama araçları sağlanır** (aşağıya bakın).

## İndirdiğini nasıl doğrularsın? / How to verify your download

### 1. SHA‑256 sağlaması
Her sürümle birlikte **`SHA256SUMS.txt`** dosyası yayınlanır. İndirdiğin dosyanın sağlamasını hesapla ve karşılaştır:

```powershell
Get-FileHash .\JahBrowser-Setup.exe -Algorithm SHA256
```

Çıkan değer `SHA256SUMS.txt` içindekiyle **birebir aynı** olmalı. Farklıysa dosya bozulmuş veya değiştirilmiş demektir — kullanma, yeniden indir.

### 2. VirusTotal taraması
**Canlı tarama sonucu (temiz):** https://www.virustotal.com/gui/url/29779ddaf5f1ef2a94b43d75a85e59a14bfde9501588b15b2670528b33ecdde7/gti-summary

Her sürüm, çok sayıda antivirüs motoruyla tarayan [VirusTotal](https://www.virustotal.com/)'a gönderilir ve sonuç linki ilgili Release açıklamasında paylaşılır. Kendi dosyanı da yükleyip tarayabilirsin.

Chromium/Electron tabanlı yapımların bazı antivirüsler tarafından **yanlışlıkla (false positive)** işaretlenebildiğini unutma — bu, Chromium tabanlı birçok meşru tarayıcının başına gelmiştir. Böyle bir durumda ilgili antivirüs sağlayıcısına "false positive" bildirimi yapılabilir.

### 3. Kendin derle
En yüksek güven: [README'deki adımlarla](README.md#-kaynaktan-derleme--build-from-source) kaynağı kendin derleyip çalıştır. Yayınlanan tüm değişiklikler `chromium-patches/` altında açıktır.

## Güvenlik açığı bildirimi / Reporting a vulnerability

Bir güvenlik açığı bulursan lütfen **herkese açık issue açmak yerine** deponun **Security → Report a vulnerability** (GitHub private advisory) akışını kullan. Mümkünse: etkilenen sürüm, yeniden üretim adımları ve etkiyi belirt.

## Yanlış pozitif (false positive) bildirimi

Bir antivirüs JahBrowser'ı yanlışlıkla işaretliyorsa:
1. Dosyanın `SHA256SUMS.txt` ile eşleştiğini doğrula (gerçekten resmi dosya mı?).
2. İlgili antivirüs sağlayıcısının "false positive submission" formuna dosyayı bildir.
3. Depoda bir issue açarak durumu bize de haber ver.
