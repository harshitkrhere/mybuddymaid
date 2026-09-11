// components/shared/AssistantLauncher.tsx — the support assistant's button, and nothing else
// until it is pressed.
//
// This follows Analytics.tsx exactly, with one deliberate difference. Analytics loads on the
// first interaction OR after four seconds; the assistant loads on INTENT ONLY — a click on
// the button. A visitor who never opens the chat downloads a button and a few hundred bytes
// of inline script, and the site's near-zero-JavaScript property on 2,513 pages is kept
// (AUDIT/01-ARCHITECTURE.md §3: "exactly two client components"; this adds none).
//
// The button is server-rendered. The inline script, on first click, injects
// /chat/widget.css and /chat/widget.js and hands the widget its options: the endpoint, the
// page's own locality context (read from the first data-mbm-* CTA on the page, so no page
// needs wiring), and every customer-facing string, rendered here from lib/assistant/copy.ts
// so the widget itself carries no copy.

import Script from 'next/script';
import { COPY } from '@/lib/assistant/copy';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164, SUPPORT_WHATSAPP_NUMBER, SUPPORT_HOURS } from '@/data/seo/contact';

export interface LauncherOptions {
  endpoint: string;
  title: string;
  greeting: string;
  notice: string;
  privacyUrl: string;
  privacyLabel: string;
  placeholder: string;
  sendLabel: string;
  closeLabel: string;
  thinkingLabel: string;
  sourceLabel: string;
  talkToTeam: string;
  whatsappPrefix: string;
  errorText: string;
  phoneE164: string;
  phoneDisplay: string;
  whatsappNumber: string;
  hoursLabel: string;
}

/** The options the widget receives. Exported so the booking app's launcher can reuse them. */
export const LAUNCHER_OPTIONS: LauncherOptions = {
  endpoint: '/api/chat',
  title: 'MyBuddyMaid assistant',
  greeting: COPY.greeting,
  notice: COPY.notice,
  privacyUrl: '/privacy-policy',
  privacyLabel: 'Privacy Policy',
  placeholder: 'Ask about areas, plans, prices…',
  sendLabel: 'Send',
  closeLabel: 'Close chat',
  thinkingLabel: 'Assistant is typing',
  sourceLabel: COPY.sourceLabel,
  talkToTeam: COPY.talkToTeam,
  whatsappPrefix: 'Hi MyBuddyMaid, I was chatting with your assistant',
  errorText: COPY.refuse,
  phoneE164: SUPPORT_PHONE_E164,
  phoneDisplay: SUPPORT_PHONE_DISPLAY,
  whatsappNumber: SUPPORT_WHATSAPP_NUMBER,
  hoursLabel: SUPPORT_HOURS.label,
};

/**
 * JSON safe to embed in a <script>: "<" becomes a unicode escape so no "</script>" inside a
 * string can close the tag early, and the two line-terminator characters JSON allows but JS
 * string literals (pre-ES2019 engines) do not are escaped as well.
 */
function embed(value: unknown): string {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(value).split('<').join('\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

const BOOTSTRAP = `
(function(){
  var OPTS=${embed(LAUNCHER_OPTIONS)};
  var btn=document.getElementById('mbm-launcher');
  if(!btn)return;
  var loading=false;
  function ctx(){
    var el=document.querySelector('[data-mbm-city]');
    var d=el?el.dataset:{};
    var pick=function(v){return v&&v!=='(none)'?v:undefined};
    return {city:pick(d.mbmCity),locality:pick(d.mbmLocality),service:pick(d.mbmService),plan:pick(d.mbmPlan),
      device:window.innerWidth<768?'mobile':window.innerWidth<1024?'tablet':'desktop'};
  }
  function load(){
    if(window.MBMChat){window.MBMChat.open();return;}
    if(loading)return; loading=true;
    btn.setAttribute('aria-busy','true');
    var css=document.createElement('link'); css.rel='stylesheet'; css.href='/chat/widget.css';
    document.head.appendChild(css);
    var s=document.createElement('script'); s.src='/chat/widget.js'; s.async=true;
    s.onload=function(){
      btn.removeAttribute('aria-busy');
      OPTS.context=ctx();
      window.MBMChat.init(OPTS).open();
    };
    s.onerror=function(){ btn.removeAttribute('aria-busy'); loading=false; };
    document.head.appendChild(s);
  }
  btn.addEventListener('click',load);
})();
`;

export function AssistantLauncher() {
  return (
    <>
      <button id="mbm-launcher" className="mbm-launcher" type="button" aria-haspopup="dialog" aria-label="Chat with the MyBuddyMaid assistant">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
        </svg>
        <span>Ask us</span>
      </button>
      <Script id="mbm-assistant-launcher" strategy="afterInteractive">
        {BOOTSTRAP}
      </Script>
    </>
  );
}
