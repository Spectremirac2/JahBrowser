# Stabilite ve Performans

JahBrowser'ın temel vaadi: **çökme kesintiye yol açmasın, tarayıcı hafif ve stabil olsun** — özellikle video/yayın izlerken ve saatlerce açık kalan yayın oturumlarında.

## Sekme çökmesi — otomatik kurtarma
Normal tarayıcılarda bir sekmenin işlemi çökerse "Aw Snap / Hay aksi" hata sayfası kalır ve izlediğin şey kesilir. **JahBrowser bunu otomatik kurtarır:**
- Bir sekme çökerse, JahBrowser onu **taze bir işlemde anında yeniden yükler** — sen hata sayfası görmeden sayfa geri gelir.
- **Yayın sekmeleri (Kick) en hızlı** kurtarılır (~50 ms), böylece yayın kesintisi en aza iner.
- Bir sayfa **üst üste çökmeye devam ederse** (gerçekten bozuksa), sonsuz döngüye girmemek için kurtarma yavaşlar ve bir süre sonra durur (o zaman hata sayfası gösterilir).
- Form gönderimi (POST) sonrası sayfalar otomatik yenilenmez (yanlışlıkla tekrar gönderilmesin diye).

Bu tamamen otomatiktir; hiçbir ayar gerekmez.

## Tüm tarayıcı çökerse / donarsa — otomatik geri gelme
Sekme değil de **tarayıcının tamamı** donar, kendini kapatır veya direkt çökerse:
- JahBrowser **kendini otomatik yeniden başlatır ve son sekmelerini geri getirir** (`--restore-last-session`). Çoğu zaman birkaç saniyede yayınınla birlikte geri dönersin.
- Bu, hem çökmede hem de **donma (yanıt vermiyor)** durumunda çalışır.
- Açılışta hemen çökme olursa sonsuz döngüye girmez (Windows'un yerleşik koruması: 60 saniyeden kısa çalışan uygulama yeniden başlatılmaz).

## Güvenli Video Modu (GPU sorunları)
Video donması/kararması genelde ekran kartı sürücüsü kaynaklıdır. JahBrowser bunu **kendi kendine yönetir:**
- GPU tekrar tekrar çökerse tarayıcı bir sonraki açılışta **kademeli olarak daha güvenli bir video yoluna geçer** (önce DirectComposition kapatılır, sonra donanım video çözme, en son yazılım). Bunu **o makineye özel hatırlar**, böylece bir daha aynı şekilde çökmez.
- Sürücünü güncelleyip düzeltirsen, sağlıklı bir oturumun ardından kendini kademeli olarak tam hızlandırmaya geri açar.
- Kontrol Merkezi › **Stabilite**'den tek tıkla **"Güvenli Video Modu"**nu açabilirsin (video donuyor/kararıyorsa). Yeniden başlatınca etki eder. Aynı yerden **"Sıfırla"** ile tam hızlandırmaya dönersin.

## Bellek — uzun oturumlar
- **Bellek Tasarrufu (Memory Saver) varsayılan açıktır:** arka planda uzun süre kullanılmayan sekmeler bellekten boşaltılıp RAM geri kazanılır.
- **Uzun Yayın Modu** (varsayılan açık): saatlerce açık oturumlarda belleği daha agresif yönetir.
- **Yayın sekmesi asla boşaltılmaz:** kick.com sekmeleri, arka planda bile olsalar, hiçbir zaman uyutulmaz/boşaltılmaz. Bkz. [Yayın Sekmesi Koruması](yayin-korumasi.md).

## Video kararlılığı
- Donanım video çözücüsü (GPU) sorun yaşarsa, video **kararmak yerine yazılım çözücüye düşerek oynamaya devam eder**.
- GPU işlemi çökerse tarayıcı otomatik olarak daha güvenli bir moda iner (Chromium'un yerleşik güvenlik merdiveni korunur; onu bozacak riskli bayraklar hiçbir zaman gönderilmez).

## Çökme günlüğü (isteğe bağlı, yerel)
- Kontrol Merkezi › Stabilite'den açabilirsin. **Varsayılan kapalıdır (KVKK).**
- Açıkken çökme nedenlerini (GPU/sürücü bilgisiyle) **yalnızca kendi cihazında** kaydeder; **hiçbir şey gönderilmez.**
- Bir sorun yaşıyorsan günlüğü görüntüleyip paylaşabilirsin — en sık çöken donanım/sürücü kombinasyonlarını çözmemize yardımcı olur.

## Sonuç
Uzun yayın izleme oturumlarında bile JahBrowser'ın hedefi: **çökse bile sen fark etmezsin, yayının kesilmez.**
