// app/api/chatwoot/webhook/route.ts — Chatwoot's webhook lands here.
//
// The sender is the API inbox itself: Inboxes → Website assistant → Settings holds the Webhook
// URL (this route) and, beside it, the Webhook Secret that goes in CHATWOOT_WEBHOOK_SECRET. It
// carries message_created, conversation_status_changed and conversation_updated for that inbox.
// An account-level webhook (Settings → Integrations → Webhooks, where the plan has it) signs the
// same way with its own secret and reaches every inbox. Only one sender may point here: each is
// signed with its own secret, so a second one — an agent bot's outgoing URL, say — is refused
// with 401 on every delivery. Without the variable every delivery is refused with 500 — an
// unsigned receiver would let anyone write into the support record.
//
// Reads the raw body BEFORE parsing, because the signature covers the exact bytes sent.
// Answers 200 for anything handled or deliberately ignored, 401 for a bad signature, and
// 503 only when the database could not be written, so a retry (or the nightly
// reconciliation) can make the record whole.

import { NextResponse } from 'next/server';
import { verifyChatwootSignature, handleChatwootEvent, type ChatwootEvent } from '@/lib/support/chatwoot-webhook';
import { recordClientFromEnv } from '@/lib/support/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const MAX_BODY_BYTES = 512 * 1024;

export async function POST(req: Request) {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[chatwoot-webhook] CHATWOOT_WEBHOOK_SECRET is not set; refusing');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  const verdict = verifyChatwootSignature(raw, { signature: req.headers.get('x-chatwoot-signature'), timestamp: req.headers.get('x-chatwoot-timestamp') }, secret);
  if (!verdict.ok) {
    // Log the delivery id — untrusted, but useful — never the body or either signature.
    console.error(`[chatwoot-webhook] rejected (${verdict.reason}); delivery ${req.headers.get('x-chatwoot-delivery') ?? 'none'}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ChatwootEvent;
  try {
    event = JSON.parse(raw) as ChatwootEvent;
  } catch {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const client = recordClientFromEnv();
  if (!client) {
    console.error('[chatwoot-webhook] Supabase is not configured; event acknowledged but not recorded');
    return NextResponse.json({ received: true, recorded: false }, { status: 200 });
  }

  const result = await handleChatwootEvent(event, client);
  if (result.status === 'retry') {
    console.error(`[chatwoot-webhook] ${event.event}: ${result.reason}`);
    return NextResponse.json({ error: 'Temporary failure, please retry' }, { status: 503 });
  }
  return NextResponse.json({ received: true, ...result }, { status: 200 });
}
