# Yayın Sekmesi Koruması

## Nedir?
Normal tarayıcılar (Chrome dahil), bellek tasarrufu için arka plandaki sekmeleri **dondurur veya uykuya alır** (discard/freeze). Bu, canlı yayın izlerken başka sekmeye geçtiğinde yayının durmasına, sesin kesilmesine veya sekmeye dönünce baştan yüklenmesine yol açar.

JahBrowser bunu **canlı yayın sekmelerinde asla yapmaz.**

## Nasıl çalışır?
- kick.com ve twitch.tv sekmeleri, bellek yönetimi tarafından **hiçbir zaman** dondurulmaz veya boşaltılmaz.
- Başka sekmelerde çalışsan, çok sayıda sekme açsan bile yayın arka planda **kesintisiz** devam eder.
- Bu davranış otomatiktir; ayar gerektirmez.

## Neden önemli?
- Yayını arka planda dinlerken/izlerken kesinti olmaz.
- Sekmeye geri döndüğünde yayın kaldığı yerden devam eder, yeniden yüklenmez.
- Yayıncıysan, kendi yayınını izleme/moderasyon sekmen arka plandayken bile canlı kalır.

## İpuçları
- İstediğin kadar sekme açabilirsin; JahBrowser diğer sekmelerde normal bellek yönetimini uygular, yalnızca yayın sekmelerini korur.
