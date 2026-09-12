// lib/assistant/launcher-options.ts — the options the chat widget is initialised with.
//
// One definition, two consumers: components/shared/AssistantLauncher.tsx embeds it in the
// site's inline bootstrap, and scripts/seo/export-serviceability.ts writes it into
// app/src/lib/serviceability.json for the booking app. Neither the widget nor the app carries
// a sentence of its own, so every customer-facing string still traces back to copy.ts.
//
// Kept free of any Next.js import so the export script can load it under plain tsx.

import { COPY } from './copy';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164, SUPPORT_WHATSAPP_NUMBER, SUPPORT_HOURS } from '@/data/seo/contact';

export interface LauncherOptions {
  endpoint: string;
  /** Polled while a conversation is with a person; see app/api/chat/replies/route.ts. */
  repliesEndpoint: string;
  pollMs: number;
  title: string;
  greeting: string;
  notice: string;
  privacyUrl: string;
  privacyLabel: string;
  placeholder: string;
  sendLabel: string;
  closeLabel: string;
  newChatLabel: string;
  thinkingLabel: string;
  sourceLabel: string;
  talkToTeam: string;
  whatsappPrefix: string;
  errorText: string;
  phoneE164: string;
  phoneDisplay: string;
  whatsappNumber: string;
  hoursLabel: string;
  teamLabel: string;
  conversationClosed: string;
  /** Buttons under the greeting of a fresh conversation; a tap sends the text as a message. */
  starters: string[];
  /** Shown for a moment after the reference in the header is tapped, which copies it. */
  copiedLabel: string;
  /** The contact card shown before a handoff; see lib/support/contact.ts. */
  contactTitle: string;
  contactTitlePrefilled: string;
  contactNameLabel: string;
  contactPhoneLabel: string;
  contactPhonePlaceholder: string;
  contactSubmit: string;
  contactLineLabels: { name: string; phone: string };
  invalidPhone: string;
}

export const LAUNCHER_OPTIONS: LauncherOptions = {
  endpoint: '/api/chat',
  repliesEndpoint: '/api/chat/replies',
  pollMs: 10000,
  title: 'MyBuddyMaid assistant',
  greeting: COPY.greeting,
  notice: COPY.notice,
  privacyUrl: '/privacy-policy',
  privacyLabel: 'Privacy Policy',
  placeholder: 'Ask about areas, plans, prices…',
  sendLabel: 'Send',
  closeLabel: 'Close chat',
  newChatLabel: 'New chat', // approved by the owner, 2026-09-11
  thinkingLabel: 'Assistant is typing',
  sourceLabel: COPY.sourceLabel,
  talkToTeam: COPY.talkToTeam,
  whatsappPrefix: 'Hi MyBuddyMaid, I was chatting with your assistant',
  errorText: COPY.refuse,
  phoneE164: SUPPORT_PHONE_E164,
  phoneDisplay: SUPPORT_PHONE_DISPLAY,
  whatsappNumber: SUPPORT_WHATSAPP_NUMBER,
  hoursLabel: SUPPORT_HOURS.label,
  teamLabel: COPY.teamLabel,
  conversationClosed: COPY.conversationClosed,
  starters: [...COPY.starters],
  copiedLabel: COPY.copied,
  contactTitle: COPY.contactTitle,
  contactTitlePrefilled: COPY.contactTitlePrefilled,
  contactNameLabel: COPY.contactNameLabel,
  contactPhoneLabel: COPY.contactPhoneLabel,
  contactPhonePlaceholder: COPY.contactPhonePlaceholder,
  contactSubmit: COPY.contactSubmit,
  contactLineLabels: { ...COPY.contactLineLabels },
  invalidPhone: COPY.invalidPhone,
};
