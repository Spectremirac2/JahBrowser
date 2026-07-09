# Jah Tema Tokenlari (`jah-theme.css`)

JahBrowser'in varsayilan koyu ("Jah") temasinin design token katmani. Tum UI bilesenleri renk, tipografi, spacing, radius, golge ve gecis degerlerini **yalnizca** bu dosyadaki `--jah-*` CSS custom property'lerinden alir; hicbir bilesende hardcoded hex bulunmaz. JahMod temalari bu `:root` katmanini override eder.

Kaynak arastirmalar:

- `research/12-entegrasyon-derinlesme/jah-tema-tokenlari.md` (somut hex paleti, dogrulama tablosu)
- `research/01-jahrein/jahrein-marka.md` (marka turetim gerekceleri)

## Temel Kurallar

1. **Dark-first**: koyu tema varsayilandir (`color-scheme: dark`). Acik tema ayri bir override dosyasi olarak sonraki surume ertelenmistir.
2. **Yesil / kirmizi anlam ayrimi kilitli**: `--jah-live` (yesil) = izledigin kanal canli (Kick dili); `--jah-onair` (kirmizi) = SEN yayindasin / kayittasin. Temalar bu iki tokeni asla ayni degere set edemez.
3. **Neon yesil metin rengi degildir**: `--jah-accent` (#53FC18) yalnizca rozet zemini, aktif cizgi, ikon stroke ve glow olarak kullanilir. Yesil zemin ustunde metin `--jah-text-on-accent` (koyu) olur.
4. **Derinlik = daha acik yuzey**: golge yerine yuzey acikligi (`--jah-surface` → `--jah-surface-2` → `--jah-surface-overlay`); saf siyah genis yuzeyde kullanilmaz.
5. **Dis font/asset yok**: tipografi tamamen sistem font yiginidir.

## Renk Tokenlari

| Token | Deger | Kullanim |
|---|---|---|
| `--jah-bg` | `#0B0E0F` | Ana pencere/sekme arka plani (Kick ana zemini) |
| `--jah-bg-deep` | `#070909` | Tam ekran video arkasi, splash |
| `--jah-surface` | `#191B1F` | Panel, sidebar, kart, adres cubugu |
| `--jah-surface-2` | `#24272C` | Hover kartlari, dropdown, dialog (yukseltilmis) |
| `--jah-surface-overlay` | `#2C3036` | Modal/menu en ust katman |
| `--jah-border` | `#33383F` | 1px ayirici cizgiler |
| `--jah-border-strong` | `#474F54` | Aktif alan kenarligi, focus disi input |
| `--jah-scrim` | `rgba(7,9,9,.72)` | Modal arkasi karartma |
| `--jah-text` | `#F2F2F0` | Birincil metin ("Salut Beyazi") |
| `--jah-text-dim` | `#9BA1A6` | Ikincil metin, etiketler ("Sis Grisi") |
| `--jah-text-muted` | `#6B7178` | Devre disi / placeholder |
| `--jah-text-on-accent` | `#0B0E0F` | Yesil zemin ustu metin |
| `--jah-text-on-danger` | `#FFFFFF` | Kirmizi zemin ustu metin |
| `--jah-link` | `#3B9EFF` | Linkler (hover'da yesile donmez) |
| `--jah-accent` | `#53FC18` | Birincil aksan (Kick "Harlequin" yesili) |
| `--jah-accent-hover` | `#71FD44` | Aksan hover |
| `--jah-accent-pressed` | `#3FD30E` | Aksan basili |
| `--jah-accent-subtle` | `rgba(83,252,24,.12)` | Secili satir / aktif menu yikamasi |
| `--jah-accent-glow` | `0 0 12px rgba(83,252,24,.45)` | "Jahrein yayinda" glow (box-shadow) |
| `--jah-gold` | `#C9A227` | Balta Altini: premium/abone ogeleri |
| `--jah-gold-subtle` | `rgba(201,162,39,.14)` | Altin arka plan yikamasi |
| `--jah-purple` | `#9146FF` | Twitch mirasi / nostalji vurgulari |
| `--jah-purple-deep` | `#772CE8` | Twitch koyu mor varyanti |
| `--jah-live` | `#53FC18` | Canli yesili: izlenen kanal canli (LIVE pill) |
| `--jah-kick` | `#53FC18` | Kick marka yesili (platform ikonu/vurgusu) |
| `--jah-onair` | `#EB0400` | ON AIR kirmizisi: kendi yayinin/kaydin acik |
| `--jah-onair-pulse` | `rgba(235,4,0,.35)` | ON AIR nabiz animasyonu dis halkasi |
| `--jah-danger` | `#E5383B` | Balta Kirmizisi: yikici eylem, hata |
| `--jah-danger-subtle` | `rgba(229,56,59,.14)` | Hata arka plani |
| `--jah-warning` | `#F5A524` | Uyari: guncelleme bekliyor, sertifika sorunu |
| `--jah-success` | `#53FC18` | Basari ("jahW") — aksan yesiliyle ayni |
| `--jah-info` | `#3B9EFF` | Bilgi bildirimleri |

### Chat Tokenlari

| Token | Deger | Kullanim |
|---|---|---|
| `--jah-chat-bg` | `#0F1214` | Chat panel zemini |
| `--jah-chat-text` | `#F2F2F0` | Mesaj metni |
| `--jah-chat-timestamp` | `#6B7178` | Zaman damgasi |
| `--jah-chat-highlight` | `rgba(83,252,24,.10)` | Yayinci mesaji / mention satiri |
| `--jah-chat-mention` | `#F5A524` | @mention vurgusu |
| `--jah-chat-mod` | `#53FC18` | Mod rozeti |
| `--jah-chat-sub` | `#C9A227` | Abone rozeti (Balta Altini) |
| `--jah-chat-user-1..8` | `#FF6B6B` `#4ECDC4` `#FFD93D` `#6BCB77` `#4D96FF` `#C77DFF` `#FF9F45` `#F473B9` | Kullanici adi rotasyon paleti (Kick API rengi yoksa fallback) |

## Tipografi

| Token | Deger | Kullanim |
|---|---|---|
| `--jah-font-ui` | `"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif` | UI fontu (sistem yigini) |
| `--jah-font-mono` | `"Cascadia Code", "JetBrains Mono", Consolas, monospace` | Mono (adresler, dev araclari) |
| `--jah-font-size-xs` | `11px` (satir 14px) | Rozetler (LIVE/ON AIR), sayaclar |
| `--jah-font-size-sm` | `12px` (satir 16px) | Caption, sekme basliklari |
| `--jah-font-size-md` | `14px` (satir 20px) | Varsayilan UI metni |
| `--jah-font-size-lg` | `16px` (satir 22px) | Bolum/kart basliklari |
| `--jah-font-size-xl` | `20px` (satir 26px) | Dialog/ayar basliklari |
| `--jah-font-size-display` | `28px` (satir 34px) | Salut ekrani basligi |
| `--jah-font-size-chat` | `13px` (satir 19px) | Chat mesaji (12-16px ayarlanabilir) |
| `--jah-weight-regular/medium/semibold/bold` | `400/500/600/700` | Agirlik olcegi |
| `--jah-badge-letter-spacing` | `0.06em` | Rozet dizgisi (uppercase ile) |

## Spacing / Radius / Shadow / Motion

| Token | Deger | Kullanim |
|---|---|---|
| `--jah-space-1` | `4px` | Ikon-metin arasi |
| `--jah-space-2` | `8px` | Buton dikey padding, chat satir arasi |
| `--jah-space-3` | `12px` | Kart ic padding |
| `--jah-space-4` | `16px` | Panel ic padding, standart bosluk |
| `--jah-space-6` | `24px` | Bolumler arasi |
| `--jah-space-8` | `32px` | Sayfa kenar bosluklari |
| `--jah-radius-sm` | `4px` | Rozet, input |
| `--jah-radius-md` | `8px` | Buton, kart, sekme |
| `--jah-radius-lg` | `12px` | Dialog, Salut kartlari |
| `--jah-radius-full` | `999px` | LIVE pill, avatar |
| `--jah-shadow-sm/md/lg` | siyah alfa golgeler | Dusuk/orta/yuksek katman |
| `--jah-shadow-glow` | `var(--jah-accent-glow)` | Canli yayin glow |
| `--jah-duration-fast` | `120ms` | Hover, focus |
| `--jah-duration-base` | `200ms` | Panel acilis |
| `--jah-duration-slow` | `320ms` | Tema gecisi, glow fade |
| `--jah-ease` | `cubic-bezier(0.2, 0, 0, 1)` | Standart easing |
| `--jah-transition-fast/base/slow` | sure + easing kisayollari | `transition:` degerlerinde |

Yerlesim sabitleri: `--jah-tab-height: 36px`, `--jah-omnibox-height: 40px`, `--jah-sidebar-width: 240px`, `--jah-chat-panel-width: 340px`.

## Utility Siniflari

| Sinif | Aciklama |
|---|---|
| `.jah-badge-live` | Yesil LIVE pill: `--jah-live` zemin + koyu metin, uppercase, tam yuvarlak |
| `.jah-badge-onair` | Kirmizi ON AIR pill: nabiz atan nokta (`jah-pulse` animasyonu) + beyaz metin |
| `.jah-btn` | Varsayilan buton (yuzey zemin); `:hover`, `:focus-visible`, `:disabled` durumlari |
| `.jah-btn--primary` | Birincil buton: aksan yesili zemin, koyu metin |
| `.jah-btn--danger` | Yikici eylem butonu (Balta Kirmizisi) |
| `.jah-card` | Standart kart yuzeyi (`--jah-surface`, `--jah-radius-lg`) |
| `.jah-card--live` | Canli kanal karti: yesil kenarlik + `--jah-accent-glow` |

## Kullanim

```html
<link rel="stylesheet" href="jah-ui/tokens/jah-theme.css">
```

```css
.omnibox {
  height: var(--jah-omnibox-height);
  background: var(--jah-surface);
  border: 1px solid var(--jah-border);
  border-radius: var(--jah-radius-md);
  color: var(--jah-text);
  font: var(--jah-weight-regular) var(--jah-font-size-md)/var(--jah-line-md) var(--jah-font-ui);
}
```

## Notlar

- Kick yesili `#53FC18` ve zemin ailesi (`#0B0E0F`, `#191B1F`, `#24272C`, `#474F54`) dogrulanmis degerlerdir; Jahrein-spesifik tonlar (Balta Altini, Balta Kirmizisi) ve `--jah-onair` oneri niteligindedir ve resmi ortaklik durumunda tek dosyadan revize edilir.
- Kontrast hedefleri: `--jah-text` / `--jah-bg` ~17:1 (WCAG AAA); chat kullanici renkleri koyu zeminde >= 4.5:1.
- Spesifikasyonda Inter fontu onerilir; "dis asset yok" kisiti geregi bu dosya sistem yiginiyla baslar. Inter gomuldugunde yalnizca `--jah-font-ui` basina eklenir.
