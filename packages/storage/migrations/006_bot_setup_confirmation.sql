CREATE TABLE bot_setup_confirmations (
  hash text PRIMARY KEY,
  account_id text NOT NULL,
  label text NOT NULL,
  scopes text[] NOT NULL,
  encrypted jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
);
CREATE INDEX bot_setup_expiry ON bot_setup_confirmations(expires_at);
