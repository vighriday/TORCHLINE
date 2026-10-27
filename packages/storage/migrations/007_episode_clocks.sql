CREATE TABLE episode_clocks (
  world_id text PRIMARY KEY REFERENCES worlds(id),
  policy_version text NOT NULL DEFAULT 'episode-2026-10-27.1',
  durations jsonb NOT NULL DEFAULT '{"investigation":30,"challenge":90,"allocation":45,"decision":60}',
  input_window integer NOT NULL,
  phase text NOT NULL,
  deadline_at timestamptz,
  remaining_ms integer CHECK (remaining_ms >= 0),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recovery_reason text
);
CREATE INDEX episode_deadlines ON episode_clocks(deadline_at) WHERE deadline_at IS NOT NULL;
ALTER TABLE eventsub_inbox ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE eventsub_inbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX inbox_due ON eventsub_inbox(next_attempt_at,received_at) WHERE processed_at IS NULL;
