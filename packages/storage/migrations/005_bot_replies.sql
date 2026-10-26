CREATE TABLE bot_replies (
  id text PRIMARY KEY, channel_id text NOT NULL REFERENCES creators(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','uncertain')),
  sender_id text, provider_message_id text, outcome_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), sending_at timestamptz
);
CREATE INDEX pending_bot_replies ON bot_replies(created_at) WHERE status='pending';
CREATE TABLE bot_channel_limits (channel_id text PRIMARY KEY REFERENCES creators(id), next_reply_at timestamptz NOT NULL);
CREATE TABLE bot_send_limits (bot_id text PRIMARY KEY, next_send_at timestamptz NOT NULL);
