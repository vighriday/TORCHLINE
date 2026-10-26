CREATE TABLE chat_message_dedup (
  channel_id text NOT NULL, message_id text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(channel_id,message_id)
);
