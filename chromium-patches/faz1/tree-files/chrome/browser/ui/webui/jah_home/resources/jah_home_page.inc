R"JAHNTP(<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Yeni Sekme — JahBrowser</title>
<style>
  /* ============================================================
     JahBrowser — Jah Temasi tokenlari (jah-theme.css'ten satir ici)
     ============================================================ */
  :root {
    color-scheme: dark;

    --jah-bg: #0B0E0F;
    --jah-bg-deep: #070909;
    --jah-surface: #191B1F;
    --jah-surface-2: #24272C;
    --jah-surface-overlay: #2C3036;
    --jah-border: #33383F;
    --jah-border-strong: #474F54;
    --jah-scrim: rgba(7, 9, 9, 0.72);

    --jah-text: #F2F2F0;
    --jah-text-dim: #9BA1A6;
    --jah-text-muted: #6B7178;
    --jah-text-on-accent: #0B0E0F;
    --jah-text-on-danger: #FFFFFF;
    --jah-link: #3B9EFF;

    --jah-accent: #53FC18;
    --jah-accent-hover: #71FD44;
    --jah-accent-pressed: #3FD30E;
    --jah-accent-subtle: rgba(83, 252, 24, 0.12);
    --jah-accent-glow: 0 0 12px rgba(83, 252, 24, 0.45);
    --jah-gold: #C9A227;
    --jah-gold-subtle: rgba(201, 162, 39, 0.14);
    --jah-purple: #9146FF;
    --jah-purple-deep: #772CE8;

    --jah-live: #53FC18;
    --jah-kick: #53FC18;
    --jah-onair: #EB0400;
    --jah-onair-pulse: rgba(235, 4, 0, 0.35);
    --jah-danger: #E5383B;
    --jah-danger-subtle: rgba(229, 56, 59, 0.14);
    --jah-warning: #F5A524;
    --jah-success: #53FC18;
    --jah-info: #3B9EFF;

    --jah-font-ui: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    --jah-font-mono: "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace;

    --jah-font-size-xs: 11px;
    --jah-font-size-sm: 12px;
    --jah-font-size-md: 14px;
    --jah-font-size-lg: 16px;
    --jah-font-size-xl: 20px;
    --jah-font-size-display: 28px;

    --jah-line-xs: 14px;
    --jah-line-sm: 16px;
    --jah-line-md: 20px;
    --jah-line-lg: 22px;
    --jah-line-xl: 26px;
    --jah-line-display: 34px;

    --jah-weight-regular: 400;
    --jah-weight-medium: 500;
    --jah-weight-semibold: 600;
    --jah-weight-bold: 700;

    --jah-badge-letter-spacing: 0.06em;

    --jah-space-1: 4px;
    --jah-space-2: 8px;
    --jah-space-3: 12px;
    --jah-space-4: 16px;
    --jah-space-6: 24px;
    --jah-space-8: 32px;

    --jah-radius-sm: 4px;
    --jah-radius-md: 8px;
    --jah-radius-lg: 12px;
    --jah-radius-full: 999px;

    --jah-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --jah-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
    --jah-shadow-lg: 0 8px 28px rgba(0, 0, 0, 0.6);
    --jah-shadow-glow: var(--jah-accent-glow);

    --jah-duration-fast: 120ms;
    --jah-duration-base: 200ms;
    --jah-duration-slow: 320ms;
    --jah-ease: cubic-bezier(0.2, 0, 0, 1);
    --jah-transition-fast: var(--jah-duration-fast) var(--jah-ease);
    --jah-transition-base: var(--jah-duration-base) var(--jah-ease);
    --jah-transition-slow: var(--jah-duration-slow) var(--jah-ease);
  }

  /* ---------- Token utility siniflari (jah-theme.css) ---------- */
  .jah-badge-live {
    display: inline-flex;
    align-items: center;
    gap: var(--jah-space-1);
    background: var(--jah-live);
    color: var(--jah-text-on-accent);
    font-family: var(--jah-font-ui);
    font-size: var(--jah-font-size-xs);
    line-height: var(--jah-line-xs);
    font-weight: var(--jah-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--jah-badge-letter-spacing);
    padding: 2px var(--jah-space-2);
    border-radius: var(--jah-radius-full);
  }

  .jah-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--jah-space-1);
    background: var(--jah-surface-2);
    color: var(--jah-text);
    border: 1px solid var(--jah-border);
    font-family: var(--jah-font-ui);
    font-size: var(--jah-font-size-md);
    line-height: var(--jah-line-md);
    font-weight: var(--jah-weight-semibold);
    padding: var(--jah-space-2) var(--jah-space-4);
    border-radius: var(--jah-radius-md);
    cursor: pointer;
    transition: background var(--jah-transition-fast),
                border-color var(--jah-transition-fast),
                box-shadow var(--jah-transition-fast);
  }

  .jah-btn:hover {
    background: var(--jah-surface-overlay);
    border-color: var(--jah-border-strong);
  }

  .jah-btn:focus-visible {
    outline: 2px solid var(--jah-accent);
    outline-offset: 2px;
  }

  .jah-btn--primary {
    background: var(--jah-accent);
    color: var(--jah-text-on-accent);
    border-color: transparent;
  }

  .jah-btn--primary:hover {
    background: var(--jah-accent-hover);
    border-color: transparent;
  }

  .jah-btn--primary:active {
    background: var(--jah-accent-pressed);
  }

  /* ============================================================
     JahBrowser — Yeni Sekme (statik)
     Yalnizca --jah-* tokenlari kullanilir; hardcoded renk yok.
     ============================================================ */

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body { height: 100%; }

  body {
    background: var(--jah-bg);
    color: var(--jah-text);
    font-family: var(--jah-font-ui);
    font-size: var(--jah-font-size-md);
    line-height: var(--jah-line-md);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  .atmosphere {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(1100px 520px at 50% -12%, var(--jah-accent-subtle), transparent 68%),
      radial-gradient(900px 700px at 88% 112%, var(--jah-gold-subtle), transparent 62%),
      var(--jah-bg);
  }

  .atmosphere::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(var(--jah-border) 1px, transparent 1px);
    background-size: 26px 26px;
    opacity: 0.14;
    mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, black, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, black, transparent 80%);
  }

  .page {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--jah-space-8) var(--jah-space-6);
  }

  .shell {
    width: 100%;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex: 1 0 auto;
  }

  @keyframes jah-rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .rise {
    opacity: 0;
    animation: jah-rise 560ms var(--jah-ease) forwards;
  }
  .rise-1 { animation-delay: 60ms; }
  .rise-2 { animation-delay: 160ms; }
  .rise-3 { animation-delay: 280ms; }
  .rise-4 { animation-delay: 400ms; }
  .rise-5 { animation-delay: 520ms; }
  .rise-6 { animation-delay: 640ms; }

  @media (prefers-reduced-motion: reduce) {
    .rise { animation: none; opacity: 1; }
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }

  .masthead {
    text-align: center;
    margin-top: clamp(16px, 6vh, 72px);
    margin-bottom: var(--jah-space-6);
  }

  .clock {
    font-size: clamp(52px, 9vw, 84px);
    line-height: 1;
    font-weight: var(--jah-weight-bold);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    color: var(--jah-text);
  }

  .clock .sec {
    font-size: 0.34em;
    font-weight: var(--jah-weight-medium);
    color: var(--jah-text-muted);
    letter-spacing: 0;
    vertical-align: 0.12em;
    margin-left: var(--jah-space-1);
  }

  .greeting {
    margin-top: var(--jah-space-3);
    font-size: var(--jah-font-size-xl);
    line-height: var(--jah-line-xl);
    font-weight: var(--jah-weight-medium);
    color: var(--jah-text-dim);
  }

  .greeting strong {
    color: var(--jah-text);
    font-weight: var(--jah-weight-semibold);
  }

  .dateline {
    margin-top: var(--jah-space-1);
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
    color: var(--jah-text-muted);
    letter-spacing: 0.02em;
  }

  .omnibox {
    position: relative;
    display: flex;
    align-items: center;
    height: 52px;
    background: var(--jah-surface);
    border: 1px solid var(--jah-border-strong);
    border-radius: var(--jah-radius-full);
    padding: 0 var(--jah-space-4);
    gap: var(--jah-space-3);
    box-shadow: var(--jah-shadow-md);
    transition: border-color var(--jah-transition-fast),
                box-shadow var(--jah-transition-slow),
                background var(--jah-transition-fast);
    margin-bottom: var(--jah-space-8);
  }

  .omnibox:hover { background: var(--jah-surface-2); }

  .omnibox:focus-within {
    border-color: var(--jah-accent);
    box-shadow: var(--jah-shadow-md), var(--jah-accent-glow);
    background: var(--jah-surface);
  }

  .omnibox svg {
    flex: none;
    width: 18px;
    height: 18px;
    stroke: var(--jah-text-muted);
    transition: stroke var(--jah-transition-fast);
  }

  .omnibox:focus-within svg { stroke: var(--jah-accent); }

  .omnibox input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--jah-text);
    font-family: var(--jah-font-ui);
    font-size: var(--jah-font-size-lg);
    line-height: var(--jah-line-lg);
  }

  .omnibox input::placeholder { color: var(--jah-text-muted); }

  .omnibox kbd {
    flex: none;
    font-family: var(--jah-font-mono);
    font-size: var(--jah-font-size-xs);
    line-height: var(--jah-line-xs);
    color: var(--jah-text-muted);
    background: var(--jah-surface-2);
    border: 1px solid var(--jah-border);
    border-radius: var(--jah-radius-sm);
    padding: 2px 6px;
  }

  .hero {
    position: relative;
    background: var(--jah-surface);
    border: 1px solid var(--jah-border);
    border-radius: var(--jah-radius-lg);
    padding: var(--jah-space-6);
    display: flex;
    align-items: center;
    gap: var(--jah-space-6);
    overflow: hidden;
    transition: border-color var(--jah-transition-slow),
                box-shadow var(--jah-transition-slow);
    margin-bottom: var(--jah-space-6);
  }

  .hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(420px 180px at 0% 0%, var(--jah-accent-subtle), transparent 70%);
    opacity: 0;
    transition: opacity var(--jah-transition-slow);
    pointer-events: none;
  }

  .hero.is-live {
    border-color: var(--jah-live);
    box-shadow: var(--jah-accent-glow), var(--jah-shadow-lg);
  }

  .hero.is-live::before { opacity: 1; }

  .hero-avatar {
    position: relative;
    flex: none;
    width: 88px;
    height: 88px;
    border-radius: var(--jah-radius-full);
    background: var(--jah-surface-overlay);
    border: 2px solid var(--jah-border-strong);
    display: grid;
    place-items: center;
    font-size: var(--jah-font-size-display);
    font-weight: var(--jah-weight-bold);
    color: var(--jah-text);
    letter-spacing: -0.02em;
    transition: border-color var(--jah-transition-slow), box-shadow var(--jah-transition-slow);
  }

  .hero.is-live .hero-avatar {
    border-color: var(--jah-live);
    box-shadow: var(--jah-accent-glow);
  }

  .hero.is-offline .hero-avatar { filter: grayscale(0.4); }

  .hero-body { flex: 1; min-width: 0; position: relative; }

  .hero-topline {
    display: flex;
    align-items: center;
    gap: var(--jah-space-3);
    margin-bottom: var(--jah-space-2);
    flex-wrap: wrap;
  }

  .hero-channel {
    font-size: var(--jah-font-size-lg);
    line-height: var(--jah-line-lg);
    font-weight: var(--jah-weight-bold);
    letter-spacing: 0.01em;
  }

  .jah-badge-live.badge-hero {
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
    padding: var(--jah-space-1) var(--jah-space-3);
    box-shadow: var(--jah-accent-glow);
  }

  .jah-badge-live.badge-hero::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: var(--jah-radius-full);
    background: var(--jah-text-on-accent);
    animation: jah-live-blink 1.6s ease-in-out infinite;
  }

  @keyframes jah-live-blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.35; }
  }

  .badge-offline {
    display: inline-flex;
    align-items: center;
    gap: var(--jah-space-1);
    background: var(--jah-surface-overlay);
    color: var(--jah-text-dim);
    border: 1px solid var(--jah-border-strong);
    font-size: var(--jah-font-size-xs);
    line-height: var(--jah-line-xs);
    font-weight: var(--jah-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--jah-badge-letter-spacing);
    padding: var(--jah-space-1) var(--jah-space-3);
    border-radius: var(--jah-radius-full);
  }

  .badge-offline::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: var(--jah-radius-full);
    background: var(--jah-text-muted);
  }

  .hero-title {
    font-size: var(--jah-font-size-xl);
    line-height: var(--jah-line-xl);
    font-weight: var(--jah-weight-semibold);
    color: var(--jah-text);
    margin-bottom: var(--jah-space-2);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: var(--jah-space-4);
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
    color: var(--jah-text-dim);
    flex-wrap: wrap;
  }

  .hero-meta .meta-item {
    display: inline-flex;
    align-items: center;
    gap: var(--jah-space-1);
  }

  .hero-meta svg {
    width: 14px;
    height: 14px;
    stroke: var(--jah-text-muted);
    flex: none;
  }

  .hero.is-live .meta-viewers { color: var(--jah-text); font-weight: var(--jah-weight-semibold); }
  .hero.is-live .meta-viewers svg { stroke: var(--jah-accent); }

  .hero-cta { flex: none; align-self: center; position: relative; }

  .hero-cta .jah-btn {
    white-space: nowrap;
    padding: var(--jah-space-3) var(--jah-space-6);
    font-size: var(--jah-font-size-lg);
    line-height: var(--jah-line-lg);
    border-radius: var(--jah-radius-md);
  }

  .hero.is-live .hero-cta .jah-btn--primary { box-shadow: var(--jah-accent-glow); }

  .hero .state { display: none; }
  .hero.is-live  .state-live,
  .hero.is-offline .state-offline { display: block; }
  .hero.is-live  .cta-live,
  .hero.is-offline .cta-offline { display: inline-flex; }
  .hero .cta-live, .hero .cta-offline { display: none; }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--jah-space-3);
  }

  .section-title {
    font-size: var(--jah-font-size-xs);
    line-height: var(--jah-line-xs);
    font-weight: var(--jah-weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jah-text-muted);
  }

  .section-hint {
    font-size: var(--jah-font-size-xs);
    line-height: var(--jah-line-xs);
    color: var(--jah-text-muted);
  }

  .follow-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--jah-space-3);
    margin-bottom: var(--jah-space-8);
  }

  .follow-card {
    display: flex;
    align-items: center;
    gap: var(--jah-space-3);
    background: var(--jah-surface);
    border: 1px solid var(--jah-border);
    border-radius: var(--jah-radius-md);
    padding: var(--jah-space-3);
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    transition: border-color var(--jah-transition-fast),
                background var(--jah-transition-fast),
                transform var(--jah-transition-fast),
                box-shadow var(--jah-transition-slow);
  }

  .follow-card:hover {
    background: var(--jah-surface-2);
    border-color: var(--jah-border-strong);
    transform: translateY(-2px);
  }

  .follow-card:focus-visible {
    outline: 2px solid var(--jah-accent);
    outline-offset: 2px;
  }

  .follow-card.is-live { border-color: var(--jah-live); }
  .follow-card.is-live:hover { box-shadow: var(--jah-accent-glow); }

  .follow-avatar {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--jah-radius-full);
    background: var(--jah-surface-overlay);
    border: 1px solid var(--jah-border-strong);
    display: grid;
    place-items: center;
    font-size: var(--jah-font-size-md);
    font-weight: var(--jah-weight-bold);
    color: var(--jah-text-dim);
  }

  .follow-card.is-live .follow-avatar {
    border-color: var(--jah-live);
    color: var(--jah-text);
  }

  .follow-info { min-width: 0; flex: 1; }

  .follow-name {
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
    font-weight: var(--jah-weight-semibold);
    color: var(--jah-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .follow-sub {
    display: flex;
    align-items: center;
    gap: var(--jah-space-1);
    font-size: var(--jah-font-size-xs);
    line-height: var(--jah-line-xs);
    color: var(--jah-text-muted);
    white-space: nowrap;
    overflow: hidden;
  }

  .follow-sub .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: var(--jah-radius-full);
    background: var(--jah-text-muted);
  }

  .follow-card.is-live .follow-sub { color: var(--jah-text-dim); }
  .follow-card.is-live .follow-sub .dot {
    background: var(--jah-live);
    box-shadow: 0 0 6px var(--jah-live);
  }

  .shortcut-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--jah-space-3);
    margin-bottom: var(--jah-space-8);
  }

  .shortcut {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--jah-space-2);
    background: var(--jah-surface);
    border: 1px solid var(--jah-border);
    border-radius: var(--jah-radius-lg);
    padding: var(--jah-space-4) var(--jah-space-3);
    text-decoration: none;
    color: var(--jah-text-dim);
    cursor: pointer;
    transition: border-color var(--jah-transition-fast),
                background var(--jah-transition-fast),
                transform var(--jah-transition-fast),
                color var(--jah-transition-fast);
  }

  .shortcut:hover {
    background: var(--jah-surface-2);
    border-color: var(--jah-border-strong);
    color: var(--jah-text);
    transform: translateY(-3px);
  }

  .shortcut:focus-visible {
    outline: 2px solid var(--jah-accent);
    outline-offset: 2px;
  }

  .shortcut-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--jah-radius-md);
    display: grid;
    place-items: center;
    background: var(--jah-surface-overlay);
    border: 1px solid var(--jah-border);
    transition: border-color var(--jah-transition-fast), box-shadow var(--jah-transition-slow);
  }

  .shortcut-icon svg { width: 20px; height: 20px; }

  .shortcut-label {
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
    font-weight: var(--jah-weight-medium);
    letter-spacing: 0.01em;
  }

  .shortcut--kick .shortcut-icon svg    { fill: var(--jah-kick); }
  .shortcut--discord .shortcut-icon svg { fill: var(--jah-info); }
  .shortcut--x .shortcut-icon svg       { fill: var(--jah-text); }
  .shortcut--youtube .shortcut-icon svg { fill: var(--jah-danger); }

  .shortcut--kick:hover .shortcut-icon    { border-color: var(--jah-kick); box-shadow: var(--jah-accent-glow); }
  .shortcut--discord:hover .shortcut-icon { border-color: var(--jah-info); }
  .shortcut--x:hover .shortcut-icon       { border-color: var(--jah-border-strong); }
  .shortcut--youtube:hover .shortcut-icon { border-color: var(--jah-danger); }

  .footer {
    margin-top: auto;
    width: 100%;
    max-width: 760px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--jah-space-4);
    padding-top: var(--jah-space-6);
    border-top: 1px solid var(--jah-border);
  }

  .balta-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--jah-space-2);
    background: var(--jah-gold-subtle);
    border: 1px solid var(--jah-gold);
    color: var(--jah-text);
    border-radius: var(--jah-radius-full);
    padding: var(--jah-space-1) var(--jah-space-3);
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
  }

  .balta-badge svg {
    width: 14px;
    height: 14px;
    stroke: var(--jah-gold);
    flex: none;
  }

  .balta-badge .count {
    font-weight: var(--jah-weight-bold);
    font-variant-numeric: tabular-nums;
    color: var(--jah-text);
  }

  .balta-badge .label { color: var(--jah-text-dim); }

  .footer a.plain-link {
    color: var(--jah-link);
    text-decoration: none;
    font-size: var(--jah-font-size-sm);
    line-height: var(--jah-line-sm);
    border-radius: var(--jah-radius-sm);
    transition: opacity var(--jah-transition-fast);
  }

  .footer a.plain-link:hover { text-decoration: underline; }

  .footer a.plain-link:focus-visible {
    outline: 2px solid var(--jah-accent);
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .page { padding: var(--jah-space-6) var(--jah-space-4); }
    .hero { flex-direction: column; align-items: flex-start; gap: var(--jah-space-4); }
    .hero-cta { align-self: stretch; }
    .hero-cta .jah-btn { width: 100%; }
    .follow-row, .shortcut-grid { grid-template-columns: repeat(2, 1fr); }
    .footer { flex-direction: column; align-items: center; gap: var(--jah-space-3); }
  }
</style>
</head>
<body>

<div class="atmosphere" aria-hidden="true"></div>

<div class="page">
  <div class="shell">

    <!-- Saat + selamlama -->
    <header class="masthead rise rise-1">
      <div class="clock" id="clock" aria-live="off">
        --:--<span class="sec">--</span>
      </div>
      <p class="greeting" id="greeting">İyi geceler, <strong>Şef</strong></p>
      <p class="dateline" id="dateline"></p>
    </header>

    <!-- Omnibox -->
    <div class="omnibox rise rise-2" role="search">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
      </svg>
      <input type="text" id="omnibox" placeholder="Ara veya adres yaz — canlı yayınlar bir tık uzağında" autocomplete="off" spellcheck="false" aria-label="Ara veya adres yaz">
      <kbd>/</kbd>
    </div>

    <!-- HERO: Jahrein durumu -->
    <section class="hero is-live rise rise-3" id="hero" aria-label="Jahrein kanal durumu">
      <div class="hero-avatar" aria-hidden="true">J</div>

      <div class="hero-body">
        <div class="hero-topline">
          <span class="hero-channel">Jahrein</span>
          <span class="jah-badge-live badge-hero state state-live" id="liveBadge">Canlı</span>
          <span class="badge-offline state state-offline">Çevrimdışı</span>
        </div>

        <!-- Canli govde -->
        <div class="state state-live">
          <h1 class="hero-title" id="liveTitle">Baldur's Gate 3 — Honour Mode, bugün bitiriyoruz jahW</h1>
          <div class="hero-meta">
            <span class="meta-item meta-viewers">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"></path>
                <circle cx="12" cy="12" r="2.5"></circle>
              </svg>
              <span id="viewerCount">12.480</span> izleyici
            </span>
            <span class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                <path d="M8 5V3M16 5V3"></path>
              </svg>
              <span id="liveCategory">Baldur's Gate 3</span>
            </span>
            <span class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 7v5l3 2"></path>
              </svg>
              <span id="uptime">3 sa 12 dk</span>dir yayında
            </span>
          </div>
        </div>

        <!-- Cevrimdisi govde -->
        <div class="state state-offline">
          <h1 class="hero-title">Şu an yayın yok — son yayın: "Chat ile Cuma sohbeti + Elden Ring DLC"</h1>
          <div class="hero-meta">
            <span class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 7v5l3 2"></path>
              </svg>
              Son yayın 14 saat önce sona erdi
            </span>
            <span class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.7 21a2 2 0 0 1-3.4 0"></path>
              </svg>
              Yayın açılınca haber vereceğiz
            </span>
          </div>
        </div>
      </div>

      <div class="hero-cta">
        <button class="jah-btn jah-btn--primary cta-live" type="button">
          İzlemeye Geç
        </button>
        <button class="jah-btn cta-offline" type="button">
          Kanala Git
        </button>
      </div>
    </section>

    <!-- Takip akisi -->
    <section class="rise rise-4" aria-label="Takip edilen kanallar">
      <div class="section-head">
        <h2 class="section-title">Takip Akışı</h2>
        <span class="section-hint" id="followHint"></span>
      </div>
      <div class="follow-row" id="followRow"></div>
    </section>

    <!-- Hizli kisayollar -->
    <section class="rise rise-5" aria-label="Hızlı kısayollar">
      <div class="section-head">
        <h2 class="section-title">Hızlı Erişim</h2>
        <span class="section-hint">Sık kullandıkların</span>
      </div>
      <div class="shortcut-grid">
        <a class="shortcut shortcut--kick" href="https://kick.com/jahrein" title="kick.com">
          <span class="shortcut-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 3h6v6h2V7h2V5h2V3h4v6h-2v2h-2v2h2v2h2v6h-4v-2h-2v-2h-2v2H10v4H4V3z"></path>
            </svg>
          </span>
          <span class="shortcut-label">kick.com</span>
        </a>
        <a class="shortcut shortcut--discord" href="#" title="Discord">
          <span class="shortcut-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.3 5.3A16.9 16.9 0 0 0 15.1 4l-.5 1a15.6 15.6 0 0 0-5.2 0L8.9 4a16.9 16.9 0 0 0-4.2 1.3C2 9.2 1.3 13 1.6 16.7A17 17 0 0 0 6.8 19l1.1-1.8c-.6-.2-1.2-.5-1.8-.9l.4-.3a12.1 12.1 0 0 0 11 0l.4.3c-.6.4-1.2.7-1.8.9L17.2 19a17 17 0 0 0 5.2-2.3c.4-4.4-.7-8.1-3.1-11.4zM8.7 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"></path>
            </svg>
          </span>
          <span class="shortcut-label">Discord</span>
        </a>
        <a class="shortcut shortcut--x" href="#" title="X">
          <span class="shortcut-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.5 4.7H5.7l11 14.5z"></path>
            </svg>
          </span>
          <span class="shortcut-label">X</span>
        </a>
        <a class="shortcut shortcut--youtube" href="#" title="YouTube">
          <span class="shortcut-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26.4 26.4 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z"></path>
            </svg>
          </span>
          <span class="shortcut-label">YouTube</span>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer rise rise-6">
      <span class="balta-badge" title="Balta reklam engelleyici sayacı">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 4l6 6"></path>
          <path d="M12 6l6 6-2.5 2.5a4.5 4.5 0 0 1-1 4.8L13 17.8 4.7 9.5a4.5 4.5 0 0 1 4.8-1L12 6z"></path>
          <path d="M4 20l5-5"></path>
        </svg>
        <span>Balta: bugün <span class="count" id="adCount">0</span> reklam engellendi</span>
      </span>
      <a class="plain-link" href="#" title="Tüm kartları gizle, yalnızca arama kalsın">Sade moda geç</a>
    </footer>

  </div>
</div>

<script>
(function () {
  "use strict";

  // ---------------- Mock veri (v1: statik) ----------------
  // TODO(jah): jah-core + Kick public API (dev.kick.com) ile gercek veriye
  // baglanacak. Canli durum/izleyici/takip listesi PageHandler (Mojo) uzerinden
  // browser process'ten push edilecek; simdilik mock.
  var MOCK = {
    live: {
      title: "Baldur's Gate 3 — Honour Mode, bugün bitiriyoruz jahW",
      category: "Baldur's Gate 3",
      viewers: 12480,
      uptimeMinutes: 192,
      isLive: true
    },
    adsBlockedToday: 1240,
    follows: [
      { name: "Pqueen",          live: true,  viewers: 8300,  category: "Just Chatting" },
      { name: "wtcN",            live: true,  viewers: 5100,  category: "Valorant" },
      { name: "KendineMuzisyen", live: false, lastSeen: "3 sa önce" },
      { name: "Elwind",          live: false, lastSeen: "dün" }
    ]
  };

  function fmt(n) { return n.toLocaleString("tr-TR"); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // ---------------- Saat + selamlama + tarih ----------------
  var clockEl = document.getElementById("clock");
  var greetEl = document.getElementById("greeting");
  var dateEl = document.getElementById("dateline");

  function greetingFor(h) {
    if (h >= 5 && h < 12)  return "Günaydın";
    if (h >= 12 && h < 18) return "İyi günler";
    if (h >= 18 && h < 23) return "İyi akşamlar";
    return "İyi geceler";
  }

  function tickClock() {
    var now = new Date();
    clockEl.innerHTML = pad(now.getHours()) + ":" + pad(now.getMinutes()) +
      '<span class="sec">' + pad(now.getSeconds()) + "</span>";
    greetEl.innerHTML = greetingFor(now.getHours()) + ", <strong>Şef</strong>";
    dateEl.textContent = now.toLocaleDateString("tr-TR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------------- Hero: canli / cevrimdisi ----------------
  var hero = document.getElementById("hero");

  document.getElementById("liveTitle").textContent = MOCK.live.title;
  document.getElementById("liveCategory").textContent = MOCK.live.category;
  document.getElementById("viewerCount").textContent = fmt(MOCK.live.viewers);
  var up = MOCK.live.uptimeMinutes;
  document.getElementById("uptime").textContent =
    Math.floor(up / 60) + " sa " + (up % 60) + " dk";

  function applyHeroState(isLive) {
    hero.classList.toggle("is-live", isLive);
    hero.classList.toggle("is-offline", !isLive);
  }
  applyHeroState(MOCK.live.isLive);

  // ---------------- Takip akisi ----------------
  var row = document.getElementById("followRow");
  var liveCount = 0;

  MOCK.follows.forEach(function (ch) {
    if (ch.live) liveCount++;
    var a = document.createElement("a");
    a.href = "#";
    a.className = "follow-card" + (ch.live ? " is-live" : "");
    a.title = ch.live
      ? ch.name + " canlı — " + ch.category
      : ch.name + " çevrimdışı";

    var sub = ch.live
      ? fmt(ch.viewers) + " · " + ch.category
      : "Çevrimdışı · " + ch.lastSeen;

    a.innerHTML =
      '<span class="follow-avatar" aria-hidden="true">' + ch.name.charAt(0).toLocaleUpperCase("tr-TR") + "</span>" +
      '<span class="follow-info">' +
        '<span class="follow-name">' + ch.name + "</span>" +
        '<span class="follow-sub"><span class="dot"></span>' + sub + "</span>" +
      "</span>";
    row.appendChild(a);
  });

  document.getElementById("followHint").textContent =
    liveCount > 0 ? liveCount + " kanal şu an canlı" : "Şu an canlı kanal yok";

  // ---------------- Balta sayaci: yumusak sayim ----------------
  var adEl = document.getElementById("adCount");
  var target = MOCK.adsBlockedToday;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    adEl.textContent = fmt(target);
  } else {
    var t0 = null, DUR = 1200;
    function stepFn(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / DUR, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      adEl.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(stepFn);
    }
    requestAnimationFrame(stepFn);
  }

  // ---------------- "/" kisayolu omnibox'a odaklanir ----------------
  var box = document.getElementById("omnibox");
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== box) {
      e.preventDefault();
      box.focus();
    }
  });

  // ---------------- Omnibox: Enter ile ara / adrese git ----------------
  // TODO(jah): gercek omnibox davranisi icin browser-process'e Mojo ile
  // yonlendirilecek; v1'de basit yeni-sekme navigasyonu.
  box.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var q = box.value.trim();
    if (!q) return;
    var url;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q) || /^[^\s.]+\.[^\s]{2,}$/.test(q)) {
      url = /:\/\//.test(q) ? q : "https://" + q;
    } else {
      url = "https://www.google.com/search?q=" + encodeURIComponent(q);
    }
    window.location.href = url;
  });
})();
</script>

</body>
</html>
)JAHNTP"
