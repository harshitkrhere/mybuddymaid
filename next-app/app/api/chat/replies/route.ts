// app/api/chat/replies/route.ts — "has the team written back yet?"
//
// GET /api/chat/replies?conversation_id=<uuid>&after=<iso>
//   → { handed_off, replies: [{ id, sender, body, created_at }], status, closed, next_after }
//
// The widget asks this every few seconds while a conversation is with a person. The server
// pulls the conversation's messages from Chatwoot's API, records the team's replies on the
// support record (idempotent — the webhook may have got there first), and returns the ones
// written after `after`. This is the free-tier path: it needs no webhook at all, and keeps
// working unchanged once the webhook is live.
//
// What a conversation id grants: the team's replies on that conversation, for 24 hours after
// its last message (lib/support/handoff.ts, recentlyActive). The id is a random uuid held in the
// visitor's browser and is never shown to anyone else; the same possession already lets the
// holder continue the conversation. Closed conversations, and anything older, return nothing.
//
// Chatwoot is asked at most once every few seconds per conversation per instance; a poll that
// arrives sooner is answered from the record alone, so a widget left open in two tabs cannot
// turn into a stream of API calls.

import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/assistant/cors';
import { recordClientFromEnv, listMessagesAfter } from '@/lib/support/record';
import { chatwootFromEnv } from '@/lib/support/chatwoot';
import { handedOff, recentlyActive, pullReplies } from '@/lib/support/handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PULL_INTERVAL_MS = 4000;
const lastPull = new Map<string, number>();

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'GET, OPTIONS') });
}

export async function GET(req: Request) {
  const cors = corsHeaders(req, 'GET, OPTIONS');
  const headers = { ...cors, 'Cache-Control': 'no-store' };
  const now = new Date();
  const url = new URL(req.url);

  const conversationId = url.searchParams.get('conversation_id')?.toLowerCase() ?? '';
  if (!UUID.test(conversationId)) return NextResponse.json({ error: 'conversation_id required' }, { status: 400, headers });

  const afterParam = url.searchParams.get('after') ?? '';
  const afterMs = Date.parse(afterParam);
  // No usable cursor: only what is written from now on, never the whole history.
  const afterIso = Number.isFinite(afterMs) ? new Date(afterMs).toISOString() : now.toISOString();

  const record = recordClientFromEnv();
  if (!record) return NextResponse.json({ handed_off: false, replies: [], status: null, closed: false, next_after: afterIso }, { headers });

  const h = await handedOff(record, conversationId);
  if (!h || !recentlyActive(h.row, now)) return NextResponse.json({ handed_off: false, replies: [], status: null, closed: false, next_after: afterIso }, { headers });

  const chatwoot = chatwootFromEnv();
  const previous = lastPull.get(conversationId) ?? 0;
  const pullNow = now.getTime() - previous >= MIN_PULL_INTERVAL_MS;
  if (pullNow) {
    lastPull.set(conversationId, now.getTime());
    if (lastPull.size > 5000) lastPull.clear(); // crude memory bound
  }

  const result = pullNow
    ? await pullReplies(record, chatwoot, h, afterIso, now)
    : {
        replies: (await listMessagesAfter(record, conversationId, afterIso, ['agent', 'assistant']))
          .filter((r) => r.chatwoot_message_id)
          .map((r) => ({ id: r.chatwoot_message_id ?? null, sender: r.sender as 'agent' | 'assistant', body: r.body, created_at: r.created_at ?? now.toISOString() })),
        status: null,
        closed: false,
      };

  const last = result.replies[result.replies.length - 1];
  return NextResponse.json(
    {
      handed_off: true,
      replies: result.replies,
      status: result.status,
      closed: result.closed,
      next_after: last?.created_at ?? afterIso,
    },
    { headers },
  );
}
