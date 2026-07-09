// JahBrowser volume booster + per-tab volume — runs on all pages via a fork
// RenderFrameObserver (isolated world). Routes each media element through a
// WebAudio GainNode so the tab's volume can go from 0% to 500% (above the
// browser's normal 100% ceiling). Keyboard: Alt+Shift+Up/Down to change,
// Alt+Shift+0 to reset. A transient on-screen pill shows the current level.
//
// Limitation: WebAudio cannot tap DRM/EME or cross-origin-tainted media
// (e.g. some live DRM streams); there the element stays at 100%. Works on
// YouTube, VODs, clips, and most same-origin media.
(function () {
  'use strict';
  if (window.__jahVolumeActive) return;
  window.__jahVolumeActive = true;

  var MAX = 5.0;         // 500%
  var STEP = 0.1;        // 10% per keypress
  var gain = 1.0;        // current multiplier
  var ctx = null;        // shared AudioContext
  var gainNode = null;
  var wired = new WeakSet();
  var pill = null;
  var pillTimer = 0;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      gainNode.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function wire(el) {
    if (!el || wired.has(el)) return;
    if (!ensureContext()) return;
    try {
      var src = ctx.createMediaElementSource(el);
      src.connect(gainNode);
      wired.add(el);
    } catch (e) {
      // createMediaElementSource throws if already wired elsewhere or tainted.
      wired.add(el);
    }
  }

  function wireAll() {
    var media = document.querySelectorAll('video, audio');
    for (var i = 0; i < media.length; i++) wire(media[i]);
  }

  function apply() {
    if (gainNode) gainNode.gain.value = gain;
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  function showPill() {
    // Build with DOM methods only (no innerHTML) so Trusted Types CSP pages
    // (e.g. YouTube) don't block the indicator.
    if (!pill) {
      pill = document.createElement('div');
      pill.style.cssText =
        'position:fixed;z-index:2147483647;right:20px;bottom:20px;' +
        'background:#191B1F;color:#F2F2F0;border:1px solid #33383F;' +
        'border-radius:999px;padding:8px 16px;font:600 14px/1 "Segoe UI",' +
        'system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.6);' +
        'display:flex;align-items:center;gap:8px;pointer-events:none;' +
        'transition:opacity .25s;opacity:0;';
      pill.__dot = document.createElement('span');
      pill.__txt = document.createElement('span');
      pill.appendChild(pill.__dot);
      pill.appendChild(pill.__txt);
      (document.body || document.documentElement).appendChild(pill);
    }
    var pct = Math.round(gain * 100);
    var lang = (navigator.language || 'tr').toLowerCase().indexOf('en') === 0
        ? 'en' : 'tr';
    pill.__dot.textContent = '●';
    pill.__dot.style.color =
        gain > 1.0 ? '#53FC18' : (gain === 0 ? '#EB0400' : '#9BA1A6');
    pill.__txt.textContent = (lang === 'en' ? 'Volume ' : 'Ses ') + pct + '%';
    pill.style.opacity = '1';
    clearTimeout(pillTimer);
    pillTimer = setTimeout(function () { if (pill) pill.style.opacity = '0'; }, 1400);
  }

  function setGain(g) {
    gain = Math.max(0, Math.min(MAX, Math.round(g * 100) / 100));
    wireAll();
    apply();
    showPill();
  }

  window.addEventListener('keydown', function (e) {
    if (!e.altKey || !e.shiftKey) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); setGain(gain + STEP); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setGain(gain - STEP); }
    else if (e.key === '0' || e.code === 'Digit0') { e.preventDefault(); setGain(1.0); }
  }, true);

  // Wire media as it appears / starts playing.
  document.addEventListener('play', function (e) {
    if (e.target && (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO')) {
      wire(e.target); apply();
    }
  }, true);

  new MutationObserver(function () { wireAll(); }).observe(
      document.documentElement, { childList: true, subtree: true });

  // Expose current level for the browser/UI if needed.
  window.__jahGetVolume = function () { return gain; };
  window.__jahSetVolume = function (g) { setGain(g); };
})();
