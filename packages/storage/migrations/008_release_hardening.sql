CREATE TABLE input_limits (
  world_id text NOT NULL REFERENCES worlds(id), input_window integer NOT NULL,
  subject text NOT NULL, tokens double precision NOT NULL CHECK (tokens >= 0),
  observed_at timestamptz NOT NULL,
  PRIMARY KEY(world_id,input_window,subject)
);
CREATE TABLE input_rejections (
  world_id text NOT NULL REFERENCES worlds(id), input_window integer NOT NULL,
  reason text NOT NULL, dropped bigint NOT NULL DEFAULT 1,
  PRIMARY KEY(world_id,input_window,reason)
);
CREATE INDEX input_limits_age ON input_limits(observed_at);
CREATE INDEX inbox_pending_world ON eventsub_inbox((payload->>'worldId'))
  WHERE processed_at IS NULL AND payload->>'kind'='chat';
CREATE INDEX world_events_public_tail ON world_events(world_id,sequence DESC)
  WHERE event->'command'->>'type' NOT IN ('vote','allocate','inspect');
CREATE INDEX world_events_commits ON world_events(world_id,sequence DESC)
  WHERE event->'command'->>'type'='commit';
CREATE INDEX custody_world_page ON custody_events(world_id,created_at DESC,id DESC);
ALTER TABLE overlay_grants ADD COLUMN expires_at timestamptz;
