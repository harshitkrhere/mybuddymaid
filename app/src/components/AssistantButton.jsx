// app/src/components/AssistantButton.jsx — the support assistant inside the booking app.
//
// The same widget the website uses (next-app/public/chat/widget.js), loaded from the same
// origin on first click, with two differences: the signed-in session token is passed so
// /api/chat can attribute the conversation to the account (it is verified server-side by
// asking Supabase Auth, never trusted from the body), and the options come from
// serviceability.json rather than an inline script. Every string still originates in
// next-app/lib/assistant/copy.ts.
//
// This replaced the header's notification bell, a control the audit found had no behaviour
// and a permanent unread dot (FIN-A02). This one does something.
//
// Local dev note: `npm run dev` serves the app on :5173, where /chat/widget.js and /api/chat
// do not exist — they are on the Next.js site. The button is inert there; test it on the
// site's dev server (which serves /app/* from the committed bundle) or in production.
import { useState } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ASSISTANT } from '../lib/serviceability';

let loading = null;

function loadWidget() {
  if (window.MBMChat) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/chat/widget.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = '/chat/widget.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      loading = null;
      reject(new Error('widget failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export default function AssistantButton() {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || null;
      await loadWidget();
      const w = window.innerWidth;
      const opts = { ...ASSISTANT, token, context: { device: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop' } };
      if (!window.MBMChat.initialised) {
        window.MBMChat.init(opts);
        window.MBMChat.initialised = true;
      } else if (token) {
        window.MBMChat.setToken(token);
      }
      window.MBMChat.open();
    } catch {
      // Nothing to show: the widget is not served from this origin (local dev) or failed.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="app-header-btn"
      style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.08)', color: '#F1F5F9' }}
      onClick={open}
      aria-label="Ask the MyBuddyMaid assistant"
      aria-haspopup="dialog"
      aria-busy={busy || undefined}
    >
      {busy ? <Loader2 size={18} className="spin" /> : <MessageCircle size={18} />}
    </button>
  );
}
