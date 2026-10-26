ALTER TABLE subscriptions
  ADD COLUMN version text NOT NULL DEFAULT '1',
  ADD COLUMN condition jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN callback text NOT NULL DEFAULT '',
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN confirmed_at timestamptz;
CREATE INDEX subscriptions_channel_status ON subscriptions(channel_id,type,status);
ALTER TABLE creators ADD COLUMN reconciled_at timestamptz, ADD COLUMN reconcile_error text;
CREATE TABLE integration_deliveries (
  message_id text PRIMARY KEY, channel_id text NOT NULL REFERENCES creators(id),
  subscription_id text NOT NULL, kind text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX integration_deliveries_channel ON integration_deliveries(channel_id,received_at DESC);
