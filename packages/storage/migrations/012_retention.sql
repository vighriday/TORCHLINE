-- Bounded retention for operational rows.
--
-- Growth that must never happen: eventsub_inbox and chat_message_dedup take one row per delivered
-- chat message, so a long-running channel grows without limit. Neither is a proof or history record;
-- world_events, custody_events, raid_proofs and handoffs are and are never pruned here.
--
-- Lifetime diagnostics read terminal inbox rows. A scheduled sweep folds those counts into
-- retention_totals before deleting, so a pruned channel still reports the same applied/quarantined
-- totals it reported before.
CREATE TABLE retention_totals (
  channel_id text NOT NULL, kind text NOT NULL, value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(channel_id,kind)
);
CREATE INDEX eventsub_inbox_received ON eventsub_inbox(received_at);
CREATE INDEX chat_dedup_received ON chat_message_dedup(received_at);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX outbox_delivered ON outbox(created_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX input_limits_window ON input_limits(observed_at);