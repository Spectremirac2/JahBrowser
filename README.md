<div align="center">

# JahBrowser

**A crash‑resistant, Chromium‑based Windows browser built for Kick viewers and streamers.**

[![License](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0A0E13.svg)]()
[![Chromium](https://img.shields.io/badge/based%20on-Chromium%20152-2ecc71.svg)]()

### [![Download JahBrowser for Windows](https://img.shields.io/badge/⬇%20Download-JahBrowser%20for%20Windows-2ecc71?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Spectremirac2/JahBrowser/releases/latest/download/JahBrowser-Setup.exe)

**Latest version** · Windows 10/11 · [Portable (.zip)](https://github.com/Spectremirac2/JahBrowser/releases/latest/download/JahBrowser-Portable.zip) · [All releases](../../releases/latest)

[**Why doesn't it crash?**](#-why-doesnt-it-crash-or-close) · [**Why is it fast?**](#-why-is-it-fast) · [**Features**](#-features) · [**Build**](#-build-from-source) · [**Security**](SECURITY.md)

**English** · [**Türkçe**](README.tr.md)

<img src="docs/screenshots/01-new-tab.png" alt="JahBrowser new tab" width="90%">

</div>

---

## What is it?

JahBrowser is an open‑source, Chromium‑152‑based Windows browser designed for **Kick** viewers and streamers. Familiar like Chrome, but built for watching live streams — **faster and snappier than a stock Chromium**, and engineered so **a crash never interrupts your stream.**

- **Fast & snappy** — instant new tabs, instant tab switching, no AI bloat (explained below).
- **Crash‑resistant** — even if a tab crashes, your stream keeps going (explained below).
- **No‑plugin emote engine** — 7TV / BTTV / FFZ / Kick emotes render directly in chat.
- **Engine‑level ad blocking (Balta)** — ~93,000 ad/tracker domains + YouTube ad‑skip + cosmetic filtering.
- **Live side panel** — the Kick channels you follow in one place, with real live data.
- **Per‑site volume booster** (0–500%) + loudness normalization, multistream, streamer mode, native Kick mod tools.

<div align="center">
<img src="docs/screenshots/02-control-center.png" alt="Control Center" width="49%">
<img src="docs/screenshots/03-multistream.png" alt="Multistream" width="49%">
</div>

---

## 🛡️ Why doesn't it crash or close?

This is JahBrowser's single most important difference. The short answer: **it keeps Chromium's rock‑solid multi‑process core and adds a whole‑browser recovery + protection layer** — so nothing interrupts your stream, and if something does die it comes right back.

There are two *different* problems here, and most "crash recovery" only handles the first:

- **A single tab crashes** → the classic **"Aw, Snap!"** page.
- **The whole browser freezes, closes itself, or vanishes** → everything is gone. This is the one that hurts during a long stream, and the one most tools ignore.

JahBrowser handles both. Here is each real problem and exactly how it's solved:

### Problem: a tab crashes ("Aw, Snap!")
**Solution — invisible tab recovery.** If a tab's renderer process crashes, JahBrowser **reloads it automatically in a fresh process** instead of showing an error page — usually it's back before you notice.
- **Stream tabs (kick.com) recover fastest (~50 ms);** other tabs ~400 ms.
- **Only genuine crashes** are recovered; tabs you closed or that were evicted to save memory are never reloaded by mistake.
- **Infinite‑loop protection:** a page that keeps crashing backs off (1 s → 3 s → 10 s) and eventually shows the error page — a broken site can't lock the browser.
- **Form safety:** POST pages are never silently re‑submitted.

### Problem: the whole browser crashes or closes itself
**Solution — automatic relaunch + session restore.** When the *entire* browser process dies, JahBrowser tells Windows to **relaunch it and reopen your last tabs** (`--restore-last-session`). Usually you're back within seconds, with your streams. A built‑in guard (Windows won't relaunch an app that ran < 60 s) prevents a start‑up‑crash loop.

### Problem: the browser freezes / stops responding
**Solution — the same relaunch path covers hangs.** If the UI thread hangs and Windows kills the "not responding" window, it is relaunched into your previous session too. Your open tabs are continuously saved, so almost nothing is lost.

### Problem: video freezes or goes black (GPU / driver)
This is the #1 cause of freezes while watching — a flaky graphics driver. **Solution, three layers:**
1. **Software fallback** — if hardware video decode fails, video drops to software decoding and **keeps playing instead of going black** (`proprietary_codecs` + `ffmpeg_branding="Chrome"` compiled together).
2. **Self‑healing safe‑GPU ladder** — if the GPU keeps crashing, JahBrowser **remembers it for that machine** and starts up in a progressively safer video path next launch (DirectComposition off → hardware video decode off). When your driver is fixed, it gradually restores full acceleration.
3. **One‑click Safe Video Mode** — in Control Center; forces the safe path immediately if video misbehaves.

The risky flags that would *break* Chromium's GPU safety ladder (`--ignore-gpu-blocklist`, `--disable-gpu-watchdog`, …) are **never** shipped.

### Problem: long sessions eat all your RAM (out‑of‑memory)
**Solution — memory management that protects the stream.** For multi‑hour sessions, **Long Stream Mode** manages memory aggressively so idle background tabs free their RAM — but **stream tabs (kick.com) are never discarded or frozen** (`kJahStreamSite`). No matter how many tabs you open, the stream keeps playing. (For everyday use the browser keeps every tab live so switching between them is instant.)

### Bonus: it learns from crashes
An **opt‑in, local‑only** crash log (off by default, KVKK‑friendly, nothing uploaded) records the GPU/driver behind a crash, so the hardware combos that cause freezes can actually be fixed.

**In short:** same Chromium stability + invisible tab recovery + whole‑browser auto‑relaunch + a self‑healing GPU path + stream‑protected memory = **your stream is never interrupted, and if the browser ever dies it comes straight back.**

> **Honest note:** many of these freezes are caused by your GPU driver / hardware / Windows itself — no browser can *prevent* a broken driver from misbehaving. JahBrowser's job is to reduce the triggers, recover invisibly, come back in seconds if it dies, and give you easy escape hatches.

---

## ⚡ Why is it fast?

Stability is only half of it — JahBrowser is also tuned to feel **quicker and snappier than a stock Chromium/Chrome**, especially on a machine with plenty of RAM. Nothing risky is turned on; these are all about doing *less* work and *not waiting* on things you don't need to wait for.

- **Instant new tab.** The custom new tab page shows real live Kick data, but it no longer blocks the tab on network requests — the newest data is served from an in‑memory cache and refreshed in the background. In practice the first tab after launch fills in within a moment, and **every new tab after that opens in ~15 ms** instead of waiting on the network.
- **Instant tab switching.** On a machine with enough RAM there's no reason to throw idle tabs out of memory — so JahBrowser keeps them live by default. Switching back to a background tab is **immediate, with no reload**. (Multi‑hour, low‑RAM sessions can still opt into aggressive memory management via *Long Stream Mode*.)
- **No AI bloat.** Every heavyweight AI subsystem that ships in modern Chrome — Gemini/assistant, the AI Mode omnibox, Lens overlay, on‑device model execution, page‑content annotation, Compose — is **compiled out / disabled**. That's a lot of background work and memory that simply isn't there.
- **Engine‑level ad blocking.** Ads and trackers are the single biggest thing slowing normal browsing down. Blocking ~93,000 ad/tracker domains at the network layer (Balta) means pages load with far less to download, parse, and run.
- **Lower background overhead.** JahBrowser's own extras stay out of the way — e.g. the volume booster only starts watching a page once you actually use it, so ordinary browsing and scrolling carry no extra cost.
- **Startup & load tuning.** Speed‑oriented Chromium flags are on (threaded HTML body loading, resource preloading, font‑lookup prefetch, spare‑renderer priority) so cold starts and page loads stay tight.

The net effect: new tabs and tab switches feel instant, streaming pages stay smooth, and there's less invisible machinery competing for your CPU and memory than in a stock browser.

---

## ✨ Features

| Area | Feature |
|---|---|
| **Speed** | Instant new tab (cached live data, no network block) · instant tab switching (tabs stay live) · no AI bloat (Gemini/Lens/on‑device models compiled out) · engine‑level ad blocking · startup/load flag tuning |
| **Stability** | Whole‑browser auto‑relaunch (crash + hang) · tab crash recovery · self‑healing safe‑GPU ladder + Safe Video Mode · stream‑tab keep‑alive · Long Stream Mode · opt‑in local crash log |
| **Streaming** | Live side panel (real Kick data + avatars) · multistream grid · go‑live desktop notification · Theater (fullscreen) mode |
| **Chat / Emotes** | No‑plugin 7TV/BTTV/FFZ/Kick emote rendering · emote picker + menu · keyword highlight + mention sound · message history |
| **Kick mod tools** | Native mod panel (chatter roster + user‑card · link/spam/flood/CAPS flags · deletion detection) — 100% client‑side |
| **Ads / Privacy** | Balta adblock (~93k domains + cosmetic + YouTube ad‑skip) · DoH on · opt‑in telemetry |
| **Sound** | Per‑site volume booster 0–500% · loudness/normalize · volume mixer popup |
| **Personalization** | Custom new tab (live Kick data) · editable follow list · dark mode · search shortcuts · bilingual (EN/TR) |

Detailed usage guides live in [`docs/kullanim/`](docs/kullanim/).

---

## ⬇️ Download & verify

1. From the [**Releases**](../../releases/latest) page, download `JahBrowser-Setup.exe` (installer) or `JahBrowser-Portable.zip` (portable — extract and run `JahBrowser.bat`).
2. The browser **starts in English by default**; you can switch to Turkish from the Control Center.

### If you see "Windows protected your PC"
JahBrowser is **open source** and currently an **unsigned** independent build. Windows SmartScreen shows this warning for **any** new, unsigned program that hasn't yet built up "reputation" — it does **not** mean the file is a virus. To continue: **"More info" → "Run anyway"**.

You don't have to take our word for it — **verify:**
- Each release publishes **`SHA256SUMS.txt`** so you can check your download's integrity (PowerShell: `Get-FileHash .\JahBrowser-Setup.exe`).
- **VirusTotal scan (clean):** [view the live report ✅](https://www.virustotal.com/gui/url/29779ddaf5f1ef2a94b43d75a85e59a14bfde9501588b15b2670528b33ecdde7/gti-summary) — each release is also scanned by file hash (links in the release notes).
- All source is in this repo — you can [build it yourself](#-build-from-source).

Details: [SECURITY.md](SECURITY.md)

---

## 🔧 Build from source

JahBrowser does not redistribute all of Chromium. Instead it follows the [ungoogled‑chromium](https://github.com/ungoogled-software/ungoogled-chromium) model: **patches applied on top of a clean Chromium tree.**

```
chromium-patches/
  faz1/
    jah-browser-faz1.patch          # main change set (~94 files)
    search-engines-submodule.patch  # search-engine data (separate submodule)
    jah-release-args.gn             # distribution build args template
    tree-files/                     # complete new files that the patch adds
```

Summary (see `chromium-patches/README.md` for detail):

1. Check out a Chromium 152 source tree (base commit `47280b64e3`), install `depot_tools`.
2. Apply the patches: `git apply chromium-patches/faz1/jah-browser-faz1.patch`
3. Create `out/Release/args.gn` from the `jah-release-args.gn` template. **Critical:** for a distribution build, `proprietary_codecs=true` **and** `ffmpeg_branding="Chrome"` must be set together (for video stability).
4. `gn gen out/Release && autoninja -C out/Release chrome mini_installer`

`jah-core/` (engine‑independent product logic, TypeScript) can be tested standalone: `cd jah-core && npm install && npm test`.

---

## 🔒 Privacy

- **Telemetry is off by default** (opt‑in).
- **DoH (DNS‑over‑HTTPS) is on.**
- Streamer privacy mode: designed with "what would leak if this screen were on stream?" in mind.
- Some Google services (like account sync) may not work in open‑source builds without an API key — a known Chromium behavior.

---

## 📄 License & branding

- Code: **BSD 3‑Clause** — see [LICENSE](LICENSE) and [NOTICE](NOTICE.md). Chromium and derived components remain under their own licenses.
- This is an **independent community project**, not affiliated with or endorsed by Google, Kick, 7TV, BetterTTV, or FrankerFaceZ. All trademarks belong to their respective owners.
- The "Chrome" name/logo is **not used** (Google trademark).

---

<div align="center">
<sub>Made for the Kick community ❤️ · <a href="README.tr.md">Türkçe README</a></sub>
</div>
