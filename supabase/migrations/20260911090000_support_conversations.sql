-- ═══════════════════════════════════════════════════════════════
-- The support record — one row per support interaction, on every channel.
-- docs/roadmap/mobile-payu-support-survey.md, Initiative 4 (owner decision 10, 14, 15).
--
-- Supabase is the system of record. The website and in-app assistant write here directly
-- from next-app/app/api/chat/route.ts; WhatsApp, phone and email arrive via Chatwoot's
-- webhook (a later migration adds nothing — the columns for it are already here).
--
-- RLS: a person sees only their own conversation. THERE IS NO TEAM ROLE (decision 14).
-- RLS is the entire authorisation layer for this system, and a role that can read every
-- customer's support conversations is one policy mistake from the worst exposure this
-- codebase could have. The team reads through service-role code behind an authenticated
-- route, which never touches these policies. Every write is service-role, exactly as
-- user_plans works today: no INSERT/UPDATE/DELETE policy exists for authenticated.
--
-- Additive: touches no existing table. user_id cascades from auth.users so delete-account
-- erases a customer's conversations with everything else (Privacy Policy 2.0 §8.2).
--
-- Rollback:
--   DROP TABLE IF EXISTS support_messages;
--   DROP TABLE IF EXISTS support_conversations;
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_conversations (
  id                    UUID PRIMARY KEY,
  -- Short, quotable, derived from id by lib/assistant/ref.ts. What the customer quotes on
  -- WhatsApp so the team can find the transcript. Not a secret; grants nothing.
  ref                   TEXT UNIQUE NOT NULL,
  channel               TEXT NOT NULL CHECK (channel IN ('site_chat', 'app_chat', 'whatsapp', 'phone', 'email')),
  -- The browser reference of a visitor who was not signed in. NULL once linked to an account.
  anon_id               TEXT,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  started_from          TEXT,                       -- page path or app screen
  city_slug             TEXT,
  locality_slug         TEXT,
  service_slug          TEXT,
  plan_key              TEXT,
  topic                 TEXT,                       -- the classified intent of the first message
  escalated             BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_at          TIMESTAMPTZ,
  escalation_reason     TEXT CHECK (escalation_reason IS NULL OR escalation_reason IN
                          ('asked_for_human', 'low_confidence', 'complaint', 'refund', 'safety', 'payment', 'turn_limit')),
  handled_by            TEXT,                       -- agent identifier, from Chatwoot
  first_agent_reply_at  TIMESTAMPTZ,                -- the 5-minute and 24-hour measurements
  outcome               TEXT CHECK (outcome IS NULL OR outcome IN
                          ('resolved', 'lead_captured', 'booking', 'dropped', 'out_of_hours_message')),
  -- No foreign key yet: the leads table is Phase 1d and does not exist. Add the constraint
  -- in that migration.
  lead_id               BIGINT,
  booking_id            UUID REFERENCES bookings(id) ON DELETE SET NULL,
  csat                  SMALLINT CHECK (csat IS NULL OR csat BETWEEN 1 AND 5),
  device                TEXT,                       -- mobile|tablet|desktop|app_android|app_ios
  language              TEXT,                       -- en|hi
  chatwoot_conversation_id BIGINT UNIQUE,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_messages (
  id                    BIGSERIAL PRIMARY KEY,
  conversation_id       UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender                TEXT NOT NULL CHECK (sender IN ('customer', 'assistant', 'agent', 'system')),
  -- The customer's message as typed. Redaction is applied to what leaves for a model
  -- provider, never to the record: someone who typed a number so the team could call back
  -- must not have it silently discarded.
  body                  TEXT NOT NULL,
  turn_index            INTEGER NOT NULL DEFAULT 0,
  -- Why the assistant said what it said: the entries the answer came from.
  grounded_sources      JSONB,
  -- Which model phrased it. NULL means rung 3 served the retrieved answer unphrased —
  -- the signal that the model layer was unavailable or its wording failed the gate.
  model_id              TEXT,
  rung                  SMALLINT,
  gate_rejected         BOOLEAN NOT NULL DEFAULT FALSE,
  -- Kinds of personal data stripped from the outbound copy. Never the values.
  redacted              TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sc_user      ON support_conversations (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_sc_anon      ON support_conversations (anon_id) WHERE anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sc_analytics ON support_conversations (started_at DESC, channel, outcome);
CREATE INDEX IF NOT EXISTS ix_sc_locality  ON support_conversations (city_slug, locality_slug) WHERE city_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sm_conv      ON support_messages (conversation_id, created_at);

-- ── RLS: a person sees only their own. SELECT only. ──
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own support conversations"
  ON support_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Customers can read own support messages"
  ON support_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_conversations c
     WHERE c.id = support_messages.conversation_id
       AND c.user_id = auth.uid()
  ));

-- Belt and braces: the anon role gets nothing at all, and authenticated gets SELECT only.
REVOKE ALL ON support_conversations FROM anon;
REVOKE ALL ON support_messages      FROM anon;
REVOKE INSERT, UPDATE, DELETE ON support_conversations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON support_messages      FROM authenticated;
