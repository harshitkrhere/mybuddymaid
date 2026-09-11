-- ═══════════════════════════════════════════════════════════════
-- Columns the Chatwoot webhook receiver needs on the support record.
-- Additive to 20260911090000_support_conversations.sql; apply after it.
--
--   chatwoot_message_id     — Chatwoot's id for a message. The partial unique index is what
--                             makes a redelivered webhook a no-op instead of a duplicate line
--                             in the transcript: the receiver treats PostgREST's 409 as success.
--   chatwoot_inbox_id       — which Chatwoot inbox the conversation lives in (website
--                             assistant, WhatsApp, email), for the channel analytics.
--   contact_name/phone      — for a conversation that BEGAN in Chatwoot (WhatsApp, email), the
--                             contact is the only identity there is. Disclosed under "Support
--                             interaction data" in Privacy Policy 2.0 §2.1; cascades away with
--                             the row. Phone is also how an account can later be linked.
--
-- Rollback:
--   DROP INDEX IF EXISTS uq_sm_chatwoot_message;
--   ALTER TABLE support_messages DROP COLUMN IF EXISTS chatwoot_message_id;
--   ALTER TABLE support_conversations DROP COLUMN IF EXISTS chatwoot_inbox_id,
--     DROP COLUMN IF EXISTS contact_name, DROP COLUMN IF EXISTS contact_phone;
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS chatwoot_message_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_chatwoot_message
  ON support_messages (chatwoot_message_id)
  WHERE chatwoot_message_id IS NOT NULL;

ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS chatwoot_inbox_id BIGINT,
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
