# Stabilite ve Performans

JahBrowser'ın temel vaadi: **çökme kesintiye yol açmasın, tarayıcı hafif ve stabil olsun** — özellikle video/yayın izlerken.

## Otomatik Çökme Kurtarma
Normal tarayıcılarda bir sekmenin işlemi çökerse "Aw Snap / Hay aksi" hata sayfası kalır ve izlediğin şey kesilir. **JahBrowser bunu otomatik kurtarır:**
- Bir sekme çökerse, JahBrowser onu **taze bir işlemde anında yeniden yükler** — sen hata sayfası görmeden sayfa geri gelir.
- **Yayın sekmeleri (Kick/Twitch) en hızlı** kurtarılır (~50 ms), böylece yayın kesintisi en aza iner.
- Bir sayfa **üst üste çökmeye devam ederse** (gerçekten bozuksa), sonsuz döngüye girmemek için kurtarma yavaşlar ve bir süre sonra durur (o zaman hata sayfası gösterilir).
- Form gönderimi (POST) sonrası sayfalar otomatik yenilenmez (yanlışlıkla tekrar gönderilmesin diye).

Bu tamamen otomatiktir; hiçbir ayar gerekmez. Chrome'da böyle bir özellik yoktur.

## Bellek Tasarrufu (Memory Saver)
- **Varsayılan açıktır:** arka planda uzun süre kullanılmayan sekmeler bellekten boşaltılıp RAM geri kazanılır, tarayıcı hafifler.
- **Yayın sekmesi asla boşaltılmaz:** kick.com / twitch.tv sekmeleri, arka planda bile olsalar, hiçbir zaman uyutulmaz/boşaltılmaz. Bkz. [Yayın Sekmesi Koruması](yayin-korumasi.md).

## Video Kararlılığı
- Donanım video çözücüsü (GPU) sorun yaşarsa, video **kararmak yerine yazılım çözücüye düşerek oynamaya devam eder**.
- GPU işlemi çökerse tarayıcı otomatik olarak daha güvenli bir moda iner (Chromium'un yerleşik güvenlik merdiveni korunur).

## Sonuç
Uzun yayın izleme oturumlarında bile JahBrowser'ın hedefi: **kesintisiz, düşük kaynak, stabil.**
