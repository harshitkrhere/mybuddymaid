/* public/chat/widget.js — the support assistant's chat panel.
 *
 * Plain JavaScript, no framework, no build step, ~10 KB. Loaded by the inline bootstrap in
 * components/shared/AssistantLauncher.tsx on the FIRST CLICK of the launcher and never
 * before, so the 2,513 static pages carry only a button and a few hundred bytes of script.
 * The booking app loads the same file and passes the session token.
 *
 * All customer-facing copy arrives through init(): it is rendered server-side from
 * lib/assistant/copy.ts so there is one source. This file has no sentences of its own.
 *
 * Talks to /api/chat, which answers with server-sent events (status → answer → done). Once a
 * conversation has been handed to a person it polls /api/chat/replies every few seconds and
 * shows what the team wrote in the same window — no webhook, no socket, nothing to install.
 */
(function () {
  'use strict';
  if (window.MBMChat) return;

  var STORAGE_KEY = 'mbm_chat';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, as the privacy policy states
  var MAX_STORED_TURNS = 12;

  var opts = null;
  var state = null;
  var els = {};
  var busy = false;
  var lastFocus = null;
  var pollTimer = null;
  var pollMisses = 0;
  var pollStarted = 0;

  // ── Storage ─────────────────────────────────────────────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.id && s.expires > Date.now()) return s;
      }
    } catch (e) { /* private mode, or blocked storage */ }
    return { id: uuid(), ref: null, expires: Date.now() + TTL_MS, history: [], noticeSeen: false, handedOff: false, after: null };
  }
  function save() {
    try {
      state.expires = Date.now() + TTL_MS;
      state.history = state.history.slice(-MAX_STORED_TURNS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────────────────
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'class') el.className = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function build() {
    els.panel = h('div', { class: 'mbm-chat', role: 'dialog', 'aria-label': opts.title, 'aria-modal': 'false', hidden: '' });

    els.ref = h('span', { class: 'mbm-chat__ref', text: '' });
    var header = h('div', { class: 'mbm-chat__header' }, [
      h('div', { class: 'mbm-chat__title' }, [h('strong', { text: opts.title }), els.ref]),
      h('div', { class: 'mbm-chat__actions' }, [
        h('button', { class: 'mbm-chat__new', type: 'button', onclick: reset, text: opts.newChatLabel }),
        h('button', { class: 'mbm-chat__close', type: 'button', 'aria-label': opts.closeLabel, onclick: close, text: '×' })
      ])
    ]);

    els.notice = h('div', { class: 'mbm-chat__notice', role: 'note' }, [
      h('p', { text: opts.notice }),
      h('a', { href: opts.privacyUrl, text: opts.privacyLabel, target: '_blank', rel: 'noopener' })
    ]);

    els.log = h('div', { class: 'mbm-chat__log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });

    els.escalate = h('div', { class: 'mbm-chat__escalate', hidden: '' }, [
      h('span', { text: opts.talkToTeam }),
      h('a', { class: 'mbm-chat__btn mbm-chat__btn--wa', href: '#', target: '_blank', rel: 'noopener', text: 'WhatsApp' }),
      h('a', { class: 'mbm-chat__btn mbm-chat__btn--tel', href: 'tel:' + opts.phoneE164, text: opts.phoneDisplay })
    ]);

    els.input = h('textarea', { class: 'mbm-chat__input', rows: '1', placeholder: opts.placeholder, 'aria-label': opts.placeholder, maxlength: '1500' });
    els.send = h('button', { class: 'mbm-chat__send', type: 'submit', text: opts.sendLabel });
    var form = h('form', { class: 'mbm-chat__form', onsubmit: onSubmit }, [els.input, els.send]);

    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); }
    });
    els.panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    els.panel.appendChild(header);
    els.panel.appendChild(els.notice);
    els.panel.appendChild(els.log);
    els.panel.appendChild(els.escalate);
    els.panel.appendChild(form);
    document.body.appendChild(els.panel);

    // Restore the last conversation so it continues across pages.
    if (state.history.length) {
      els.notice.hidden = state.noticeSeen;
      state.history.forEach(function (t) { addMessage(t.role, t.content, t.sources); });
      if (state.ref) els.ref.textContent = state.ref;
      if (state.handedOff) showEscalation(firstQuestion());
    } else {
      addMessage('assistant', opts.greeting);
    }
  }

  function addMessage(role, text, sources) {
    var wrap = h('div', { class: 'mbm-chat__msg mbm-chat__msg--' + role });
    if (role === 'agent') wrap.appendChild(h('span', { class: 'mbm-chat__who', text: opts.teamLabel }));
    var body = h('div', { class: 'mbm-chat__bubble' });
    // Preserve line breaks; never inject HTML.
    text.split('\n').forEach(function (line, i) {
      if (i) body.appendChild(document.createElement('br'));
      body.appendChild(document.createTextNode(line));
    });
    wrap.appendChild(body);
    if (sources && sources.length) {
      var src = h('div', { class: 'mbm-chat__sources' }, [h('span', { text: opts.sourceLabel + ': ' })]);
      sources.forEach(function (s, i) {
        if (i) src.appendChild(document.createTextNode(' · '));
        src.appendChild(h('a', { href: s.url, text: s.title }));
      });
      wrap.appendChild(src);
    }
    els.log.appendChild(wrap);
    els.log.scrollTop = els.log.scrollHeight;
    return wrap;
  }

  function setTyping(on) {
    if (on && !els.typing) {
      els.typing = h('div', { class: 'mbm-chat__msg mbm-chat__msg--assistant mbm-chat__typing', 'aria-label': opts.thinkingLabel }, [
        h('div', { class: 'mbm-chat__bubble' }, [h('span'), h('span'), h('span')])
      ]);
      els.log.appendChild(els.typing);
      els.log.scrollTop = els.log.scrollHeight;
    } else if (!on && els.typing) {
      els.typing.remove();
      els.typing = null;
    }
  }

  function showEscalation(firstQuestion) {
    var text = opts.whatsappPrefix + (state.ref ? ' (ref ' + state.ref + ')' : '') + (firstQuestion ? ': ' + firstQuestion : '');
    els.escalate.querySelector('.mbm-chat__btn--wa').href = 'https://wa.me/' + opts.whatsappNumber + '?text=' + encodeURIComponent(text);
    els.escalate.hidden = false;
  }
  function firstQuestion() {
    for (var i = 0; i < state.history.length; i++) if (state.history[i].role === 'user') return state.history[i].content.slice(0, 200);
    return '';
  }

  // ── Sending ─────────────────────────────────────────────────────────────────────────────
  function onSubmit(e) {
    if (e) e.preventDefault();
    var text = (els.input.value || '').trim();
    if (!text || busy) return;
    els.input.value = '';
    els.notice.hidden = true;
    state.noticeSeen = true;
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
    save();
    send(text);
  }

  function send(text) {
    busy = true;
    els.send.disabled = true;
    setTyping(true);

    var headers = { 'content-type': 'application/json' };
    if (opts.token) headers.authorization = 'Bearer ' + opts.token;

    var body = {
      conversation_id: state.id,
      message: text,
      history: state.history.slice(0, -1).slice(-MAX_STORED_TURNS),
      page: location.pathname,
      context: opts.context || {}
    };

    fetch(opts.endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (j) { throw new Error(j && j.error ? j.error : 'HTTP ' + res.status); },
            function () { throw new Error('HTTP ' + res.status); });
        }
        return readEvents(res, onEvent);
      })
      .catch(function (err) {
        setTyping(false);
        addMessage('assistant', (err && err.message && err.message.indexOf('HTTP') !== 0) ? err.message : opts.errorText);
        showEscalation(text);
      })
      .then(function () {
        busy = false;
        els.send.disabled = false;
        setTyping(false);
        els.input.focus();
      });
  }

  function onEvent(name, data) {
    if (name !== 'answer') return;
    setTyping(false);
    if (data.ref) { state.ref = data.ref; els.ref.textContent = data.ref; }
    if (data.conversation_id) state.id = data.conversation_id;
    addMessage('assistant', data.text, data.sources);
    state.history.push({ role: 'assistant', content: data.text, sources: data.sources });
    if (data.escalate) showEscalation(firstQuestion());
    // A handoff (or a message forwarded after one) means a person may write back: start asking.
    if (data.handoff || data.mode === 'forwarded') {
      if (!state.handedOff) { state.handedOff = true; state.after = new Date().toISOString(); }
      startPolling();
    }
    save();
  }

  // ── Replies from the team ───────────────────────────────────────────────────────────────
  // Every pollMs while the conversation is with a person and the tab is visible. Stops when the
  // team closes the conversation, when the server says it is no longer handed off (three times
  // in a row — the handoff is created just after the answer, so the first ask can be early), or
  // when the tab is hidden; a tab becoming visible asks straight away.
  function startPolling() {
    if (pollTimer || !state.handedOff || !opts.repliesEndpoint) return;
    pollMisses = 0;
    pollStarted = Date.now();
    schedule(opts.pollMs || 10000);
  }
  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }
  function schedule(ms) {
    stopPolling();
    pollTimer = setTimeout(poll, ms);
  }
  function poll() {
    pollTimer = null;
    if (!state.handedOff) return;
    if (document.visibilityState === 'hidden') return; // resumed by visibilitychange
    var headers = {};
    if (opts.token) headers.authorization = 'Bearer ' + opts.token;
    var url = opts.repliesEndpoint + '?conversation_id=' + encodeURIComponent(state.id) + '&after=' + encodeURIComponent(state.after || '');
    fetch(url, { headers: headers, cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (!data.handed_off) {
          if (++pollMisses >= 3) { state.handedOff = false; save(); }
          return;
        }
        pollMisses = 0;
        (data.replies || []).forEach(function (r) {
          var role = r.sender === 'agent' ? 'agent' : 'assistant';
          state.history.push({ role: role, content: r.body });
          if (els.panel) addMessage(role, r.body);
          if (!els.panel || els.panel.hidden) markUnread(true);
        });
        if (data.next_after) state.after = data.next_after;
        if (data.closed) {
          state.history.push({ role: 'assistant', content: opts.conversationClosed });
          if (els.panel) addMessage('assistant', opts.conversationClosed);
          state.handedOff = false;
        }
        save();
      })
      .catch(function () { /* network blip; the next poll will try again */ })
      .then(function () {
        if (!state.handedOff) return;
        // Quick for the first five minutes, then every 30 seconds.
        var base = opts.pollMs || 10000;
        schedule(Date.now() - pollStarted > 5 * 60 * 1000 ? Math.max(base, 30000) : base);
      });
  }
  function markUnread(on) {
    var btn = document.getElementById('mbm-launcher');
    if (btn) btn.classList.toggle('mbm-launcher--unread', !!on);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state && state.handedOff) { stopPolling(); poll(); }
  });

  // Server-sent events over fetch. EventSource cannot POST, so the stream is read by hand.
  function readEvents(res, cb) {
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split('\n\n');
        buf = parts.pop();
        parts.forEach(function (chunk) {
          var name = '', data = '';
          chunk.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) name = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
          });
          if (name) { try { cb(name, JSON.parse(data || '{}')); } catch (e) { /* ignore */ } }
        });
        return pump();
      });
    }
    return pump();
  }

  // ── Open / close ────────────────────────────────────────────────────────────────────────
  // A fresh conversation: new id, empty history, the notice shown again. The old one stays on
  // the server's record under its own reference; nothing here deletes anything.
  function reset() {
    if (busy) return;
    stopPolling();
    state = { id: uuid(), ref: null, expires: Date.now() + TTL_MS, history: [], noticeSeen: false, handedOff: false, after: null };
    save();
    els.log.textContent = '';
    els.typing = null;
    els.ref.textContent = '';
    els.escalate.hidden = true;
    els.notice.hidden = false;
    addMessage('assistant', opts.greeting);
    els.input.focus();
  }

  function open() {
    if (!els.panel) build();
    lastFocus = document.activeElement;
    els.panel.hidden = false;
    markUnread(false);
    document.body.classList.add('mbm-chat-open');
    els.input.focus();
    if (opts.onOpen) opts.onOpen();
  }
  function close() {
    if (!els.panel) return;
    els.panel.hidden = true;
    document.body.classList.remove('mbm-chat-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function toggle() { if (!els.panel || els.panel.hidden) open(); else close(); }

  window.MBMChat = {
    init: function (o) { opts = o; state = load(); if (state.handedOff) startPolling(); return window.MBMChat; },
    open: open,
    close: close,
    toggle: toggle,
    setToken: function (t) { if (opts) opts.token = t; }
  };
})();
