// JahBrowser native emote content script — renders 7TV (and later BTTV/FFZ)
// emotes inside Kick chat. Kick renders its OWN emotes natively (data-emote-name);
// this fills the gap for third-party emotes that otherwise appear as plain text.
//
// Injected on kick.com by a fork RenderFrameObserver. Runs in the page main world,
// so /api/v2 fetches are same-origin and 7TV (CORS *) + cdn.7tv.app images work
// (verified: kick.com CSP allows cdn.7tv.app).
(function () {
  'use strict';
  if (window.__jahEmotesActive) return;
  window.__jahEmotesActive = true;

  var SEVENTV_CDN = 'https://cdn.7tv.app/emote/';
  var BTTV_CDN = 'https://cdn.betterttv.net/emote/';
  // code -> { src1, src2, zeroWidth }. Provider-agnostic: the full image URLs
  // are precomputed so 7TV and BTTV (different CDNs) coexist in one map.
  var emotes = new Map();

  function addSevenTvSet(set) {
    if (!set || !set.emotes) return;
    for (var i = 0; i < set.emotes.length; i++) {
      var e = set.emotes[i];
      if (!e || !e.name || !e.id) continue;
      if (emotes.has(e.name)) continue;  // channel set already took priority
      var zw = ((e.flags & 1) === 1) ||
               (e.data && e.data.flags && (e.data.flags & 256) === 256);
      emotes.set(e.name, {
        src1: SEVENTV_CDN + e.id + '/1x.webp',
        src2: SEVENTV_CDN + e.id + '/2x.webp',
        zeroWidth: !!zw,
      });
    }
  }

  // BetterTTV global set (BTTV has no Kick per-channel emotes; global only).
  // Entry shape: { id, code, ... }. 7TV wins on name collisions (added first).
  function addBttvList(list) {
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.code || !e.id) continue;
      if (emotes.has(e.code)) continue;
      emotes.set(e.code, {
        src1: BTTV_CDN + e.id + '/1x.webp',
        src2: BTTV_CDN + e.id + '/2x.webp',
        zeroWidth: false,
      });
    }
  }

  function currentSlug() {
    var parts = location.pathname.split('/').filter(Boolean);
    // ignore non-channel routes
    if (!parts.length) return null;
    var bad = { 'browse': 1, 'following': 1, 'categories': 1, 'search': 1, 'dashboard': 1 };
    return bad[parts[0]] ? null : parts[0];
  }

  function makeEmote(name, meta) {
    var span = document.createElement('span');
    span.className = 'jah-emote';
    span.setAttribute('data-jah-emote', name);
    span.title = name;
    span.style.cssText =
      'display:inline-block;vertical-align:middle;' +
      (meta.zeroWidth ? 'position:relative;width:0;overflow:visible;' : '');
    var img = document.createElement('img');
    img.src = meta.src1;
    img.srcset = meta.src2 + ' 2x';
    img.alt = name;
    img.loading = 'lazy';
    img.style.cssText =
      'height:1.7em;vertical-align:middle;' +
      (meta.zeroWidth ? 'position:absolute;left:-1.7em;bottom:0;' : '');
    span.appendChild(img);
    return span;
  }

  // Replace 7TV emote codes inside the text nodes of a message element.
  // No per-node "done" cache: Kick's chat is virtualized and recycles nodes,
  // so a cached flag goes stale. Instead we re-walk cheaply and skip text that
  // is already inside a .jah-emote (converted), making this idempotent.
  function processMessage(root) {
    if (!root || root.nodeType !== 1) return false;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || !/\S/.test(n.nodeValue)) continue;
      if (n.parentElement && n.parentElement.closest('.jah-emote')) continue;
      textNodes.push(n);
    }
    var changed = false;
    for (var i = 0; i < textNodes.length; i++) {
      var tn = textNodes[i];
      if (!tn.parentNode) continue;
      var words = tn.nodeValue.split(/(\s+)/);
      var hit = false;
      for (var w = 0; w < words.length; w++) {
        if (emotes.has(words[w])) { hit = true; break; }
      }
      if (!hit) continue;
      var frag = document.createDocumentFragment();
      for (var k = 0; k < words.length; k++) {
        var word = words[k];
        if (emotes.has(word)) {
          frag.appendChild(makeEmote(word, emotes.get(word)));
        } else if (word) {
          frag.appendChild(document.createTextNode(word));
        }
      }
      tn.parentNode.replaceChild(frag, tn);
      changed = true;
    }
    highlightMessage(root);
    addTimestamp(root);
    return changed;
  }

  function scanAll() {
    var msgs = document.querySelectorAll('[data-index]');
    for (var i = 0; i < msgs.length; i++) processMessage(msgs[i]);
  }

  // ===================================================================
  // Chat comfort — keyword highlight + mention sound/notification.
  // Config is stored per-origin in localStorage; edited via a small gear
  // panel injected on the page. Works on RECEIVED messages (no login).
  // ===================================================================
  var chatCfg = null;
  var chatCssAdded = false;

  function readChatCfg() {
    var d = { keywords: [], sound: true, notify: false, timestamps: false };
    try {
      var raw = localStorage.getItem('jah.chat.cfg');
      if (raw) {
        var p = JSON.parse(raw);
        d.keywords = Array.isArray(p.keywords) ? p.keywords : [];
        d.sound = p.sound !== false;
        d.notify = !!p.notify;
        d.timestamps = !!p.timestamps;
      }
    } catch (e) {}
    return d;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function addTimestamp(root) {
    if (!chatCfg || !chatCfg.timestamps) return;
    if (!root || root.nodeType !== 1 || root.__jahTs) return;
    root.__jahTs = true;
    var d = new Date();
    var span = document.createElement('span');
    span.className = 'jah-ts';
    span.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' ';
    span.style.cssText =
      'color:#6B7178;font-size:11px;margin-right:2px;' +
      'font-variant-numeric:tabular-nums;';
    root.insertBefore(span, root.firstChild);
  }

  function saveChatCfg() {
    try { localStorage.setItem('jah.chat.cfg', JSON.stringify(chatCfg)); } catch (e) {}
  }

  function ensureHighlightCss() {
    if (chatCssAdded) return;
    chatCssAdded = true;
    var s = document.createElement('style');
    s.textContent =
      '.jah-hl{background:rgba(83,252,24,0.10)!important;' +
      'box-shadow:inset 3px 0 0 #53FC18;border-radius:4px;}';
    (document.head || document.documentElement).appendChild(s);
  }

  function playBeep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var c = new AC();
      var o = c.createOscillator();
      var g = c.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g); g.connect(c.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
      o.stop(c.currentTime + 0.36);
    } catch (e) {}
  }

  function highlightMessage(root) {
    if (!chatCfg) chatCfg = readChatCfg();
    if (!chatCfg.keywords.length || !root || root.nodeType !== 1) return;
    if (root.__jahHlDone) return;
    var text = (root.innerText || '').toLowerCase();
    var matched = false;
    for (var i = 0; i < chatCfg.keywords.length; i++) {
      var kw = chatCfg.keywords[i];
      if (kw && text.indexOf(kw) !== -1) { matched = true; break; }
    }
    root.__jahHlDone = true;
    if (!matched) return;
    ensureHighlightCss();
    root.classList.add('jah-hl');
    if (!root.__jahMentioned) {
      root.__jahMentioned = true;
      if (chatCfg.sound) playBeep();
      if (chatCfg.notify && window.Notification &&
          Notification.permission === 'granted') {
        try { new Notification('Jahrein sohbeti', {
          body: (root.innerText || '').slice(0, 120),
        }); } catch (e) {}
      }
    }
  }

  function buildChatPanel() {
    var lang = (navigator.language || 'tr').toLowerCase().indexOf('en') === 0
        ? 'en' : 'tr';
    var t = lang === 'en'
      ? { g: 'Chat', title: 'Highlight words', hint: 'Comma-separated. Messages containing them are highlighted.',
          sound: 'Mention sound', notify: 'Desktop notification', ts: 'Timestamps', save: 'Save' }
      : { g: 'Sohbet', title: 'Vurgu kelimeleri', hint: 'Virgülle ayır. İçeren mesajlar vurgulanır.',
          sound: 'Bahsedilme sesi', notify: 'Masaüstü bildirimi', ts: 'Zaman damgası', save: 'Kaydet' };
    var gear = document.createElement('button');
    gear.type = 'button';
    gear.title = t.title;
    gear.textContent = '⚙ ' + t.g;
    gear.style.cssText =
      'position:fixed;z-index:2147483646;right:16px;bottom:16px;' +
      'background:#191B1F;color:#F2F2F0;border:1px solid #33383F;' +
      'border-radius:999px;padding:8px 14px;font:600 13px "Segoe UI",' +
      'system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5);';
    var panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;z-index:2147483646;right:16px;bottom:58px;display:none;' +
      'width:280px;background:#191B1F;color:#F2F2F0;border:1px solid #33383F;' +
      'border-radius:12px;padding:14px;font:14px "Segoe UI",system-ui,sans-serif;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.6);';
    var ta = document.createElement('textarea');
    ta.value = chatCfg.keywords.join(', ');
    ta.placeholder = 'jahrein, klip, önemli';
    ta.style.cssText =
      'width:100%;height:56px;background:#0B0E0F;color:#F2F2F0;' +
      'border:1px solid #33383F;border-radius:8px;padding:8px;resize:vertical;' +
      'font:13px "Segoe UI",system-ui,sans-serif;box-sizing:border-box;';
    var mkChk = function (labelText, checked) {
      var lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:#9BA1A6;cursor:pointer;';
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = checked;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(labelText));
      lab.__cb = cb;
      return lab;
    };
    var title = document.createElement('div');
    title.textContent = t.title;
    title.style.cssText = 'font-weight:600;margin-bottom:6px;';
    var hint = document.createElement('div');
    hint.textContent = t.hint;
    hint.style.cssText = 'font-size:12px;color:#6B7178;margin-bottom:8px;';
    var soundChk = mkChk(t.sound, chatCfg.sound);
    var notifyChk = mkChk(t.notify, chatCfg.notify);
    var tsChk = mkChk(t.ts, chatCfg.timestamps);
    var save = document.createElement('button');
    save.type = 'button'; save.textContent = t.save;
    save.style.cssText =
      'margin-top:12px;width:100%;background:#53FC18;color:#0B0E0F;border:none;' +
      'border-radius:8px;padding:8px;font:600 14px "Segoe UI",system-ui;cursor:pointer;';
    save.addEventListener('click', function () {
      chatCfg.keywords = ta.value.split(',').map(function (s) {
        return s.trim().toLowerCase();
      }).filter(Boolean);
      chatCfg.sound = soundChk.__cb.checked;
      chatCfg.notify = notifyChk.__cb.checked;
      chatCfg.timestamps = tsChk.__cb.checked;
      saveChatCfg();
      if (chatCfg.notify && window.Notification &&
          Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) {}
      }
      // If timestamps were turned off, remove the ones already shown.
      if (!chatCfg.timestamps) {
        document.querySelectorAll('.jah-ts').forEach(function (el) {
          el.remove();
        });
        document.querySelectorAll('[data-index]').forEach(function (el) {
          el.__jahTs = false;
        });
      }
      // Re-evaluate visible messages against the new keywords / timestamps.
      document.querySelectorAll('[data-index]').forEach(function (el) {
        el.__jahHlDone = false; el.classList.remove('jah-hl');
      });
      scanAll();
      panel.style.display = 'none';
    });
    panel.appendChild(title);
    panel.appendChild(hint);
    panel.appendChild(ta);
    panel.appendChild(soundChk);
    panel.appendChild(notifyChk);
    panel.appendChild(tsChk);
    panel.appendChild(save);
    gear.addEventListener('click', function () {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    (document.body || document.documentElement).appendChild(gear);
    (document.body || document.documentElement).appendChild(panel);
  }

  function startChatComfort() {
    if (window.__jahChatStarted) return;
    window.__jahChatStarted = true;
    chatCfg = readChatCfg();
    var attach = function () {
      if (document.body && !document.getElementById('jahChatGear')) {
        buildChatPanel();
        return true;
      }
      return false;
    };
    if (!attach()) setTimeout(attach, 1500);
  }

  function chatRoot() {
    return document.querySelector('#chatroom') ||
           document.querySelector('[class*="chatroom"]') ||
           document.body;
  }

  function observe() {
    var root = chatRoot();
    if (!root) { setTimeout(observe, 1000); return; }
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') {
          var host = m.target.parentElement &&
                     m.target.parentElement.closest('[data-index]');
          if (host) { host.__jahDirty = true; processMessage(host); }
          continue;
        }
        for (var a = 0; a < m.addedNodes.length; a++) {
          var node = m.addedNodes[a];
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches('[data-index]')) {
            processMessage(node);
          } else if (node.querySelectorAll) {
            var inner = node.querySelectorAll('[data-index]');
            for (var q = 0; q < inner.length; q++) processMessage(inner[q]);
          }
        }
      }
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    window.__jahEmotesObserver = obs;
    scanAll();
    // Safety net for the virtualized/recycled chat DOM: a light periodic
    // re-scan catches anything the observer missed. Idempotent + cheap
    // (~30 visible messages; converted emotes are skipped).
    if (window.__jahEmotesTimer) clearInterval(window.__jahEmotesTimer);
    window.__jahEmotesTimer = setInterval(scanAll, 1500);
  }

  function loadEmotesThenStart() {
    var slug = currentSlug();
    // Load the channel's 7TV set FIRST so its custom emotes win any name
    // collision, then the global sets (7TV + BTTV) in parallel.
    var channelJob = Promise.resolve();
    if (slug) {
      channelJob = fetch('/api/v2/channels/' + slug)
        .then(function (r) { return r.json(); })
        .then(function (ch) {
          if (!ch || !ch.user_id) return null;
          return fetch('https://7tv.io/v3/users/kick/' + ch.user_id)
            .then(function (r) { return r.json(); })
            .then(function (d) { addSevenTvSet(d && d.emote_set); });
        })
        .catch(function () {});
    }
    channelJob.then(function () {
      return Promise.all([
        fetch('https://7tv.io/v3/emote-sets/global')
          .then(function (r) { return r.json(); })
          .then(addSevenTvSet)
          .catch(function () {}),
        fetch('https://api.betterttv.net/3/cached/emotes/global')
          .then(function (r) { return r.json(); })
          .then(addBttvList)
          .catch(function () {}),
      ]);
    }).then(function () {
      startChatComfort();
      if (!emotes.size) return;
      observe();
      startPicker();
      startEmoteMenu();
    });
  }

  // ===================================================================
  // Emote autocomplete picker — type part of an emote name in the Kick
  // chat box and pick it from a floating list. Works with 7TV + BTTV
  // names already loaded above. Attaches to whatever input Kick renders
  // (textarea or contenteditable); the input only exists when logged in.
  // ===================================================================
  var picker = null;
  var pickerItems = [];
  var pickerIndex = 0;
  var pickerInput = null;

  function buildPickerBox() {
    var box = document.createElement('div');
    box.className = 'jah-emote-picker';
    box.style.cssText =
      'position:fixed;z-index:2147483647;display:none;background:#191B1F;' +
      'border:1px solid #33383F;border-radius:10px;padding:4px;' +
      'max-height:290px;overflow-y:auto;min-width:210px;' +
      'box-shadow:0 8px 28px rgba(0,0,0,0.6);font-family:inherit;';
    document.body.appendChild(box);
    return box;
  }

  function matchEmotes(prefix) {
    var lower = prefix.toLowerCase();
    var starts = [];
    var contains = [];
    emotes.forEach(function (meta, name) {
      var idx = name.toLowerCase().indexOf(lower);
      if (idx === 0) starts.push({ name: name, meta: meta });
      else if (idx > 0) contains.push({ name: name, meta: meta });
    });
    starts.sort(function (a, b) { return a.name.length - b.name.length; });
    contains.sort(function (a, b) { return a.name.length - b.name.length; });
    return starts.concat(contains).slice(0, 8);
  }

  function currentWord(input) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      var val = input.value || '';
      var pos = input.selectionStart;
      var s = pos;
      while (s > 0 && !/\s/.test(val[s - 1])) s--;
      var e = pos;
      while (e < val.length && !/\s/.test(val[e])) e++;
      return { word: val.slice(s, e), start: s, end: e, val: val };
    }
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var node = sel.focusNode;
    if (!node || node.nodeType !== 3) return null;
    var text = node.nodeValue || '';
    var off = sel.focusOffset;
    var cs = off;
    while (cs > 0 && !/\s/.test(text[cs - 1])) cs--;
    var ce = off;
    while (ce < text.length && !/\s/.test(text[ce])) ce++;
    return { word: text.slice(cs, ce), start: cs, end: ce, node: node };
  }

  function renderPicker() {
    if (!picker) picker = buildPickerBox();
    if (!pickerItems.length || !pickerInput) { picker.style.display = 'none'; return; }
    if (pickerIndex >= pickerItems.length) pickerIndex = 0;
    picker.textContent = '';
    for (var i = 0; i < pickerItems.length; i++) {
      (function (it, i) {
        var row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;gap:8px;padding:5px 8px;' +
          'border-radius:6px;cursor:pointer;color:#F2F2F0;font-size:13px;' +
          (i === pickerIndex ? 'background:rgba(83,252,24,0.16);' : '');
        var img = document.createElement('img');
        img.src = it.meta.src1;
        img.style.cssText = 'height:24px;width:auto;flex:none;';
        row.appendChild(img);
        var span = document.createElement('span');
        span.textContent = it.name;
        row.appendChild(span);
        row.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          applyPick(i);
        });
        picker.appendChild(row);
      })(pickerItems[i], i);
    }
    picker.style.display = 'block';
    var rect = pickerInput.getBoundingClientRect();
    picker.style.left = Math.round(rect.left) + 'px';
    picker.style.top = Math.max(8, Math.round(rect.top - picker.offsetHeight - 6)) + 'px';
  }

  function applyPick(i) {
    var it = pickerItems[i];
    if (!it || !pickerInput) return;
    var cw = currentWord(pickerInput);
    if (!cw) { hidePicker(); return; }
    var insert = it.name + ' ';
    if (cw.val !== undefined) {
      var nv = cw.val.slice(0, cw.start) + insert + cw.val.slice(cw.end);
      pickerInput.value = nv;
      var p = cw.start + insert.length;
      try { pickerInput.setSelectionRange(p, p); } catch (e) {}
      pickerInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (cw.node) {
      cw.node.nodeValue =
        cw.node.nodeValue.slice(0, cw.start) + insert + cw.node.nodeValue.slice(cw.end);
      try {
        var r = document.createRange();
        r.setStart(cw.node, cw.start + insert.length);
        r.collapse(true);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      } catch (e2) {}
      pickerInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    hidePicker();
    pickerInput.focus();
  }

  function hidePicker() {
    if (picker) picker.style.display = 'none';
    pickerItems = [];
    pickerIndex = 0;
  }

  function onPickerInput(e) {
    pickerInput = e.target;
    var cw = currentWord(pickerInput);
    if (!cw || cw.word.length < 2) { hidePicker(); return; }
    pickerItems = matchEmotes(cw.word);
    pickerIndex = 0;
    renderPicker();
  }

  function onPickerKeydown(e) {
    if (!picker || picker.style.display === 'none' || !pickerItems.length) return;
    if (e.key === 'ArrowDown') {
      pickerIndex = (pickerIndex + 1) % pickerItems.length;
      e.preventDefault(); renderPicker();
    } else if (e.key === 'ArrowUp') {
      pickerIndex = (pickerIndex - 1 + pickerItems.length) % pickerItems.length;
      e.preventDefault(); renderPicker();
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      applyPick(pickerIndex);
    } else if (e.key === 'Escape') {
      hidePicker();
    }
  }

  function attachPicker(input) {
    if (input.__jahPickerAttached) return;
    input.__jahPickerAttached = true;
    input.addEventListener('input', onPickerInput);
    // Capture phase so Tab/Enter are handled before Kick's editor sends.
    input.addEventListener('keydown', onPickerKeydown, true);
    input.addEventListener('blur', function () { setTimeout(hidePicker, 150); });
  }

  function findChatInput() {
    var root = document.querySelector('[class*="chatroom"]') || document.body;
    return root.querySelector(
      'textarea, [contenteditable="true"], [contenteditable=""]');
  }

  // ---- Message history — ↑/↓ recall previously sent messages (terminal
  // style). Yields the arrows to the emote picker while it is open. ----
  var msgHistory = [];
  var msgHistIdx = -1;

  function inputText(input) {
    return input.value != null ? input.value : (input.textContent || '');
  }

  function setInputText(input, text) {
    if (input.value != null) {
      input.value = text;
      try { input.setSelectionRange(text.length, text.length); } catch (e) {}
    } else {
      input.textContent = text;
      try {
        var r = document.createRange();
        r.selectNodeContents(input);
        r.collapse(false);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      } catch (e2) {}
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function attachHistory(input) {
    if (input.__jahHistAttached) return;
    input.__jahHistAttached = true;
    input.addEventListener('keydown', function (e) {
      // The emote picker owns the arrows while it is showing suggestions.
      if (picker && picker.style.display !== 'none' && pickerItems.length) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        var txt = inputText(input).trim();
        if (txt && msgHistory[msgHistory.length - 1] !== txt) {
          msgHistory.push(txt);
          if (msgHistory.length > 50) msgHistory.shift();
        }
        msgHistIdx = msgHistory.length;
        return;  // let the message send
      }
      if (e.key === 'ArrowUp') {
        if (!msgHistory.length) return;
        // Once we're navigating history, keep going regardless of caret; the
        // first ↑ only kicks in when the caret is at the start / input empty,
        // so normal multi-line editing still works.
        var navigating = msgHistIdx >= 0 && msgHistIdx < msgHistory.length;
        var atStart = input.selectionStart === 0 || inputText(input) === '';
        if (!navigating && !atStart) return;
        if (msgHistIdx < 0 || msgHistIdx > msgHistory.length) {
          msgHistIdx = msgHistory.length;
        }
        if (msgHistIdx > 0) {
          msgHistIdx--;
          e.preventDefault();
          setInputText(input, msgHistory[msgHistIdx]);
        }
      } else if (e.key === 'ArrowDown') {
        if (msgHistIdx < 0 || msgHistIdx >= msgHistory.length) return;
        msgHistIdx++;
        e.preventDefault();
        setInputText(input,
                     msgHistIdx < msgHistory.length ? msgHistory[msgHistIdx] : '');
      }
    }, true);
  }

  function startPicker() {
    if (window.__jahPickerStarted) return;
    window.__jahPickerStarted = true;
    var tryAttach = function () {
      var input = findChatInput();
      if (input) { attachPicker(input); attachHistory(input); }
    };
    tryAttach();
    // The chat input is added lazily (and only when logged in); watch for it.
    new MutationObserver(tryAttach).observe(document.body,
                                            { childList: true, subtree: true });
  }

  // ===================================================================
  // Emote menu — a 😀 button that opens a clickable grid of all loaded
  // emotes (7TV + BTTV). Clicking one inserts its code into the chat box.
  // The type-to-autocomplete picker (above) and this browse-menu complement
  // each other. Only shown once the emote set is loaded.
  // ===================================================================
  function insertIntoInput(input, text) {
    if (!input) return;
    input.focus();
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      var start = input.selectionStart != null ? input.selectionStart
                                               : (input.value || '').length;
      var end = input.selectionEnd != null ? input.selectionEnd : start;
      var v = input.value || '';
      input.value = v.slice(0, start) + text + v.slice(end);
      var np = start + text.length;
      try { input.setSelectionRange(np, np); } catch (e) {}
    } else {
      try { document.execCommand('insertText', false, text); }
      catch (e) { input.textContent = (input.textContent || '') + text; }
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function buildEmoteMenu() {
    var lang = (navigator.language || 'tr').toLowerCase().indexOf('en') === 0
        ? 'en' : 'tr';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'jahEmoteMenuBtn';
    btn.textContent = '😀';
    btn.title = lang === 'en' ? 'Emotes' : 'Emote menüsü';
    btn.style.cssText =
      'position:fixed;z-index:2147483646;right:16px;bottom:96px;' +
      'width:40px;height:40px;border-radius:999px;background:#191B1F;' +
      'color:#F2F2F0;border:1px solid #33383F;font-size:18px;cursor:pointer;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.5);';
    var panel = document.createElement('div');
    panel.id = 'jahEmoteMenuPanel';
    panel.style.cssText =
      'position:fixed;z-index:2147483646;right:16px;bottom:142px;display:none;' +
      'width:308px;max-height:340px;overflow-y:auto;background:#191B1F;' +
      'border:1px solid #33383F;border-radius:12px;padding:8px;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.6);';
    var search = document.createElement('input');
    search.type = 'text';
    search.placeholder = lang === 'en' ? 'Search emote…' : 'Emote ara…';
    search.style.cssText =
      'width:100%;box-sizing:border-box;margin-bottom:6px;background:#0B0E0F;' +
      'color:#F2F2F0;border:1px solid #33383F;border-radius:8px;padding:6px 8px;' +
      'font:13px "Segoe UI",system-ui,sans-serif;';
    var grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;';

    function renderGrid(query) {
      grid.textContent = '';
      var q = (query || '').toLowerCase();
      var count = 0;
      emotes.forEach(function (meta, name) {
        if (count >= 180) return;  // cap for performance
        if (q && name.toLowerCase().indexOf(q) === -1) return;
        count++;
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.title = name;
        cell.style.cssText =
          'background:transparent;border:none;padding:4px;border-radius:6px;' +
          'cursor:pointer;display:flex;align-items:center;justify-content:center;';
        var img = document.createElement('img');
        img.src = meta.src1;
        img.loading = 'lazy';
        img.style.cssText = 'width:28px;height:28px;object-fit:contain;';
        cell.appendChild(img);
        cell.addEventListener('mouseenter', function () {
          cell.style.background = 'rgba(83,252,24,0.14)';
        });
        cell.addEventListener('mouseleave', function () {
          cell.style.background = 'transparent';
        });
        cell.addEventListener('mousedown', function (e) {
          e.preventDefault();
          insertIntoInput(findChatInput(), name + ' ');
        });
        grid.appendChild(cell);
      });
    }
    search.addEventListener('input', function () { renderGrid(search.value); });
    renderGrid('');
    panel.appendChild(search);
    panel.appendChild(grid);
    btn.addEventListener('click', function () {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    (document.body || document.documentElement).appendChild(btn);
    (document.body || document.documentElement).appendChild(panel);
  }

  function startEmoteMenu() {
    if (window.__jahEmoteMenuStarted || !emotes.size) return;
    window.__jahEmoteMenuStarted = true;
    if (document.body) buildEmoteMenu();
    else setTimeout(function () { if (document.body) buildEmoteMenu(); }, 1500);
  }

  loadEmotesThenStart();
  // Kick is a SPA; re-init on client-side channel changes so the emote set
  // follows the channel the user navigates to.
  var lastPath = location.pathname;
  setInterval(function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      emotes.clear();
      loadEmotesThenStart();
    }
  }, 2000);
})();
