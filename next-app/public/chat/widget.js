/* public/chat/widget.js — the support assistant's chat panel.
 *
 * Plain JavaScript, no framework, no build step. Loaded by the inline bootstrap in
 * components/shared/AssistantLauncher.tsx on the FIRST CLICK of the launcher and never
 * before, so the 2,513 static pages carry only a button and a few hundred bytes of script.
 * The booking app loads the same file and passes the session token.
 *
 * All customer-facing copy arrives through init(): it is rendered server-side from
 * lib/assistant/copy.ts so there is one source. This file has no sentences of its own — that
 * includes the prompts it offers as buttons: the starters under the greeting come with the
 * options, and the follow-ups under each answer come from the server with the answer
 * (lib/assistant/suggestions.ts). A tap sends the prompt as the customer's own message.
 *
 * Before a person gets the conversation the server asks for a name and mobile number
 * (contact_required on the answer) and the panel shows a card for them; sending it posts the
 * details as the customer's message with the fields alongside, and the server opens the
 * conversation for the team before it says so. A signed-in customer's number arrives
 * pre-filled to confirm.
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
  var INPUT_MAX_ROWS = 5;

  var opts = null;
  var state = null;
  var els = {};
  var busy = false;
  var lastFocus = null;
  var pollTimer = null;
  var pollMisses = 0;
  var pollStarted = 0;
  var copiedTimer = null;

  // ── Storage ─────────────────────────────────────────────────────────────────────────────
  function fresh() {
    return { id: uuid(), ref: null, expires: Date.now() + TTL_MS, history: [], noticeSeen: false, handedOff: false, after: null, suggestions: null, contact: null };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.id && s.expires > Date.now()) return s;
      }
    } catch (e) { /* private mode, or blocked storage */ }
    return fresh();
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

  // ── Phone numbers: the same rule as lib/support/contact.ts, so the card can say what is
  // wrong before anything is sent. The server decides again regardless. ──
  function normalisePhone(raw) {
    var d = String(raw || '').replace(/[^\d+]/g, '');
    if (d.charAt(0) === '+') d = d.slice(1);
    if (d.indexOf('0091') === 0) d = d.slice(4);
    else if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? '+91' + d : null;
  }
  function formatPhone(e164) { return '+91 ' + e164.slice(3, 8) + ' ' + e164.slice(8); }

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
  // A stroked line icon; the styling (size, stroke) is the stylesheet's.
  function icon(d) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }
  var ICON_CLOSE = 'M6 6l12 12M18 6L6 18';
  var ICON_SEND = 'M12 19V5M5 12l7-7 7 7';
  var ICON_NEW = 'M12 5v14M5 12h14';

  // Only where a pointer can hover does a field take focus on its own; on a phone that would
  // raise the keyboard over what the customer has not read yet.
  function focusEl(el) {
    if (!el) return;
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
    el.focus();
  }
  function focusInput() { focusEl(els.input); }

  function build() {
    els.panel = h('div', { class: 'mbm-chat', role: 'dialog', 'aria-label': opts.title, 'aria-modal': 'false', hidden: '' });

    els.ref = h('button', { class: 'mbm-chat__ref', type: 'button', hidden: '', onclick: copyRef });
    var header = h('div', { class: 'mbm-chat__header' }, [
      h('div', { class: 'mbm-chat__brand' }, [
        h('span', { class: 'mbm-chat__dot', 'aria-hidden': 'true' }),
        h('div', { class: 'mbm-chat__title' }, [h('strong', { text: opts.title }), els.ref])
      ]),
      h('div', { class: 'mbm-chat__actions' }, [
        h('button', { class: 'mbm-chat__new', type: 'button', onclick: reset }, [icon(ICON_NEW), h('span', { text: opts.newChatLabel })]),
        h('button', { class: 'mbm-chat__close', type: 'button', 'aria-label': opts.closeLabel, onclick: close }, [icon(ICON_CLOSE)])
      ])
    ]);

    els.log = h('div', { class: 'mbm-chat__log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });

    els.escalate = h('div', { class: 'mbm-chat__escalate', hidden: '' }, [
      h('span', { class: 'mbm-chat__escalate-text', text: opts.talkToTeam }),
      h('div', { class: 'mbm-chat__escalate-actions' }, [
        h('a', { class: 'mbm-chat__btn mbm-chat__btn--wa', href: '#', target: '_blank', rel: 'noopener', text: 'WhatsApp' }),
        h('a', { class: 'mbm-chat__btn mbm-chat__btn--tel', href: 'tel:' + opts.phoneE164, text: opts.phoneDisplay })
      ])
    ]);

    els.input = h('textarea', { class: 'mbm-chat__input', rows: '1', placeholder: opts.placeholder, 'aria-label': opts.placeholder, maxlength: '1500', autocomplete: 'off' });
    els.send = h('button', { class: 'mbm-chat__send', type: 'submit', 'aria-label': opts.sendLabel, disabled: '' }, [icon(ICON_SEND)]);
    var form = h('form', { class: 'mbm-chat__composer', onsubmit: onSubmit }, [els.input, els.send]);

    els.input.addEventListener('input', onInput);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); }
    });
    els.panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    els.panel.appendChild(header);
    els.panel.appendChild(els.log);
    els.panel.appendChild(els.escalate);
    els.panel.appendChild(form);
    document.body.appendChild(els.panel);

    renderConversation();
  }

  // The log, from the state: the notice first (it scrolls away with the conversation instead of
  // holding a fixed strip, and goes once the first message is sent), then the turns, then what
  // trails — the contact card while details are wanted, else the starters under a fresh greeting
  // or the last answer's follow-ups.
  function renderConversation() {
    els.log.textContent = '';
    els.typing = null;
    els.chips = null;
    els.card = null;
    els.notice = h('div', { class: 'mbm-chat__notice', role: 'note' }, [
      h('p', { text: opts.notice }),
      h('a', { href: opts.privacyUrl, text: opts.privacyLabel, target: '_blank', rel: 'noopener' })
    ]);
    els.notice.hidden = !!state.noticeSeen;
    els.log.appendChild(els.notice);

    if (state.history.length) {
      state.history.forEach(function (t) { addMessage(t.role, t.content, t.sources); });
    } else {
      addMessage('assistant', opts.greeting);
    }
    setRef(state.ref);

    if (state.handedOff) showEscalation(firstQuestion());
    if (state.contact) renderContactCard(state.contact.prefill);
    else if (!hasUserTurn()) renderChips(opts.starters || []);
    else if (state.suggestions && state.suggestions.length) renderChips(state.suggestions);
    scrollToEnd();
  }
  function hasUserTurn() {
    for (var i = 0; i < state.history.length; i++) if (state.history[i].role === 'user') return true;
    return false;
  }
  // Whatever sits at the end of the log for the customer to act on; messages go above it.
  function trailing() { return els.card || els.chips || null; }
  function place(el) {
    var t = trailing();
    if (t) els.log.insertBefore(el, t); else els.log.appendChild(el);
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
    place(wrap);
    scrollToEnd();
    return wrap;
  }
  function scrollToEnd() { els.log.scrollTop = els.log.scrollHeight; }

  // Prompts offered as buttons: one wrapping row under the latest answer. Gone the moment the
  // customer sends anything, so the log never carries a stale offer.
  function renderChips(list) {
    clearChips();
    if (!list || !list.length) return;
    els.chips = h('div', { class: 'mbm-chat__chips' });
    list.forEach(function (text) {
      els.chips.appendChild(h('button', { class: 'mbm-chat__chip', type: 'button', text: text, onclick: function () { submitText(text); } }));
    });
    els.log.appendChild(els.chips);
    scrollToEnd();
  }
  function clearChips() {
    if (els.chips) { els.chips.remove(); els.chips = null; }
  }

  // The contact card: a name and a mobile number, before a person gets the conversation. Stays
  // up — with what has been typed into it — under anything answered meanwhile, until the details
  // are sent or the server stops asking.
  function renderContactCard(prefill) {
    clearChips();
    if (els.card) return;
    var title = h('p', { class: 'mbm-chat__contact-title', text: prefill && prefill.phone ? opts.contactTitlePrefilled : opts.contactTitle });
    els.cardName = h('input', { type: 'text', name: 'name', autocomplete: 'name', maxlength: '60', required: '' });
    els.cardPhone = h('input', { type: 'tel', name: 'phone', autocomplete: 'tel', inputmode: 'tel', maxlength: '20', required: '', placeholder: opts.contactPhonePlaceholder });
    if (prefill) {
      if (prefill.name) els.cardName.value = prefill.name;
      if (prefill.phone) els.cardPhone.value = prefill.phone;
    }
    els.cardPhone.addEventListener('input', function () { els.cardPhone.setCustomValidity(''); });
    els.cardSubmit = h('button', { class: 'mbm-chat__contact-submit', type: 'submit', text: opts.contactSubmit });
    els.cardSubmit.disabled = busy;
    els.card = h('form', { class: 'mbm-chat__contact', onsubmit: onContactSubmit }, [
      title,
      h('label', null, [h('span', { text: opts.contactNameLabel }), els.cardName]),
      h('label', null, [h('span', { text: opts.contactPhoneLabel }), els.cardPhone]),
      els.cardSubmit
    ]);
    els.log.appendChild(els.card);
    scrollToEnd();
    focusEl(prefill && prefill.name ? els.cardPhone : els.cardName);
  }
  function clearCard() {
    if (els.card) { els.card.remove(); els.card = null; els.cardName = null; els.cardPhone = null; els.cardSubmit = null; }
  }
  function onContactSubmit(e) {
    if (e) e.preventDefault();
    if (busy) return;
    var name = (els.cardName.value || '').trim();
    var phone = normalisePhone(els.cardPhone.value);
    if (!phone) {
      els.cardPhone.setCustomValidity(opts.invalidPhone);
      els.cardPhone.reportValidity();
      return;
    }
    var line = (name ? opts.contactLineLabels.name + ': ' + name + '\n' : '') + opts.contactLineLabels.phone + ': ' + formatPhone(phone);
    var hist = sentHistory();
    clearCard();
    state.contact = null;
    els.notice.hidden = true;
    state.noticeSeen = true;
    addMessage('user', line);
    // Kept out of the history sent with later messages: the details are for the team, and the
    // server already has them on the record.
    state.history.push({ role: 'user', content: line, contact: true });
    state.suggestions = null;
    save();
    send(line, hist, { name: name, phone: phone });
  }

  function setTyping(on) {
    if (on && !els.typing) {
      els.typing = h('div', { class: 'mbm-chat__msg mbm-chat__msg--assistant mbm-chat__typing', 'aria-label': opts.thinkingLabel }, [
        h('div', { class: 'mbm-chat__bubble' }, [h('span'), h('span'), h('span')])
      ]);
      place(els.typing);
      scrollToEnd();
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
    for (var i = 0; i < state.history.length; i++) if (state.history[i].role === 'user' && !state.history[i].contact) return state.history[i].content.slice(0, 200);
    return '';
  }

  // ── The reference: shown under the title, copied with a tap ────────────────────────────
  function setRef(ref) {
    els.ref.hidden = !ref;
    els.ref.textContent = ref || '';
  }
  function copyRef() {
    if (!state.ref || !navigator.clipboard) return;
    navigator.clipboard.writeText(state.ref).then(function () {
      els.ref.textContent = opts.copiedLabel || state.ref;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(function () { els.ref.textContent = state.ref || ''; }, 1400);
    }, function () { /* clipboard refused; the reference is still on screen */ });
  }

  // ── Composer ────────────────────────────────────────────────────────────────────────────
  // The input grows with what is typed, up to a few lines, and the send button is live only
  // when there is something to send.
  function onInput() {
    els.input.style.height = 'auto';
    var line = parseFloat(getComputedStyle(els.input).lineHeight) || 21;
    var max = line * INPUT_MAX_ROWS + 22;
    var wanted = els.input.scrollHeight;
    els.input.style.height = Math.min(wanted, max) + 'px';
    els.input.style.overflowY = wanted > max ? 'auto' : 'hidden';
    updateSend();
  }
  function updateSend() {
    els.send.disabled = busy || !(els.input.value || '').trim();
    if (els.cardSubmit) els.cardSubmit.disabled = busy;
  }

  function onSubmit(e) {
    if (e) e.preventDefault();
    var text = (els.input.value || '').trim();
    if (!text) return;
    submitText(text);
  }
  // The turns sent with a message: everything before it, minus the contact details.
  function sentHistory() {
    return state.history.filter(function (t) { return !t.contact; }).slice(-MAX_STORED_TURNS);
  }
  function submitText(text) {
    if (busy) return;
    els.input.value = '';
    onInput();
    els.notice.hidden = true;
    state.noticeSeen = true;
    clearChips();
    var hist = sentHistory();
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
    state.suggestions = null;
    save();
    send(text, hist, null);
  }

  function send(text, hist, contact) {
    busy = true;
    updateSend();
    setTyping(true);

    var headers = { 'content-type': 'application/json' };
    if (opts.token) headers.authorization = 'Bearer ' + opts.token;

    var body = {
      conversation_id: state.id,
      message: text,
      history: hist,
      page: location.pathname,
      context: opts.context || {}
    };
    if (contact) body.contact = contact;

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
        setTyping(false);
        updateSend();
        focusInput();
      });
  }

  function onEvent(name, data) {
    if (name !== 'answer') return;
    setTyping(false);
    if (data.ref) { state.ref = data.ref; setRef(data.ref); }
    if (data.conversation_id) state.id = data.conversation_id;
    addMessage('assistant', data.text, data.sources);
    state.history.push({ role: 'assistant', content: data.text, sources: data.sources });
    // A handoff (or a message forwarded after one) means a person may write back: start asking.
    var withPerson = !!(data.handoff || data.mode === 'forwarded');
    if (withPerson) {
      if (!state.handedOff) { state.handedOff = true; state.after = new Date().toISOString(); }
      startPolling();
    }
    // The WhatsApp-or-call card stays only while it is the answer: offered with this reply, or
    // once a person has the conversation. An ordinary answer after a refusal takes it away.
    if (data.escalate || withPerson || state.handedOff) showEscalation(firstQuestion());
    else els.escalate.hidden = true;
    // The contact card, while the server wants a name and number; gone the moment it stops.
    if (data.contact_required) {
      state.contact = { prefill: data.contact_prefill || null };
      renderContactCard(state.contact.prefill);
    } else if (state.contact || els.card) {
      state.contact = null;
      clearCard();
    }
    state.suggestions = withPerson || data.contact_required ? null : (data.suggestions && data.suggestions.length ? data.suggestions : null);
    if (state.suggestions) renderChips(state.suggestions);
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
  // A fresh conversation: new id, empty history, the notice and the starters shown again. The
  // old one stays on the server's record under its own reference; nothing here deletes anything.
  function reset() {
    if (busy) return;
    stopPolling();
    state = fresh();
    save();
    els.escalate.hidden = true;
    renderConversation();
    focusInput();
  }

  function open() {
    if (!els.panel) build();
    lastFocus = document.activeElement;
    els.panel.hidden = false;
    // Two frames so the first paint is the closed state and the transition has somewhere to go.
    requestAnimationFrame(function () { requestAnimationFrame(function () { els.panel.classList.add('mbm-chat--open'); }); });
    markUnread(false);
    document.body.classList.add('mbm-chat-open');
    scrollToEnd();
    focusInput();
    if (opts.onOpen) opts.onOpen();
  }
  function close() {
    if (!els.panel) return;
    els.panel.classList.remove('mbm-chat--open');
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
