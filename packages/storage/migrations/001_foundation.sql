CREATE TABLE creators (
  id text PRIMARY KEY, label text NOT NULL, mode text NOT NULL CHECK (mode IN ('simulation','live')),
  receive_opt_in boolean NOT NULL DEFAULT false, connected boolean NOT NULL DEFAULT false
);
CREATE TABLE worlds (
  id text PRIMARY KEY, mode text NOT NULL CHECK (mode IN ('simulation','live')),
  custodian_id text NOT NULL REFERENCES creators(id), revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state jsonb NOT NULL, frozen_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state->'resources'->>'hull')::integer BETWEEN 0 AND 100),
  CHECK ((state->'resources'->>'oxygen')::integer BETWEEN 0 AND 100),
  CHECK ((state->'resources'->>'power')::integer BETWEEN 0 AND 100),
  CHECK ((state->'resources'->>'navigation')::integer BETWEEN 0 AND 100),
  CHECK ((state->'resources'->>'passengers')::integer BETWEEN 0 AND 216),
  CHECK ((state->'resources'->>'supplies')::integer BETWEEN 0 AND 999)
);
CREATE TABLE channel_slots (channel_id text PRIMARY KEY REFERENCES creators(id), world_id text NOT NULL UNIQUE REFERENCES worlds(id));
CREATE TABLE world_events (
  world_id text NOT NULL REFERENCES worlds(id), sequence integer NOT NULL,
  event jsonb NOT NULL, PRIMARY KEY (world_id, sequence)
);
CREATE TABLE world_commands (
  world_id text NOT NULL REFERENCES worlds(id), actor_id text NOT NULL, command_id text NOT NULL,
  request_hash text NOT NULL, PRIMARY KEY(world_id, actor_id, command_id)
);
CREATE TABLE outbox (id bigserial PRIMARY KEY, world_id text NOT NULL REFERENCES worlds(id), revision integer NOT NULL, delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX pending_outbox ON outbox(id) WHERE delivered_at IS NULL;
CREATE TABLE sessions (hash text PRIMARY KEY, channel_id text NOT NULL REFERENCES creators(id), expires_at timestamptz NOT NULL);
CREATE TABLE overlay_grants (hash text PRIMARY KEY, channel_id text NOT NULL REFERENCES creators(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE oauth_states (hash text PRIMARY KEY, role text NOT NULL CHECK (role IN ('creator','bot')), expires_at timestamptz NOT NULL);
CREATE TABLE oauth_grants (id text PRIMARY KEY, role text NOT NULL, scopes text[] NOT NULL, encrypted jsonb NOT NULL, validated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE subscriptions (id text PRIMARY KEY, type text NOT NULL, channel_id text NOT NULL, status text NOT NULL);
CREATE TABLE eventsub_inbox (message_id text PRIMARY KEY, type text NOT NULL, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, error text);
CREATE TABLE handoffs (
  id text PRIMARY KEY, world_id text NOT NULL REFERENCES worlds(id), source_id text NOT NULL REFERENCES creators(id), target_id text NOT NULL REFERENCES creators(id),
  mode text NOT NULL CHECK (mode IN ('simulation','live')), status text NOT NULL CHECK (status IN ('prepared','verified','committed','cancelled','expired','declined')),
  frozen_revision integer NOT NULL, proof_id text UNIQUE, prepared_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX one_pending_world ON handoffs(world_id) WHERE status IN ('prepared','verified');
CREATE UNIQUE INDEX one_pending_source ON handoffs(source_id) WHERE status IN ('prepared','verified');
CREATE TABLE raid_proofs (message_id text PRIMARY KEY, mode text NOT NULL, source_id text NOT NULL, target_id text NOT NULL, subscription_id text NOT NULL, notification_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), consumed_by text UNIQUE REFERENCES handoffs(id));
CREATE TABLE custody_events (id text PRIMARY KEY, world_id text NOT NULL REFERENCES worlds(id), source_id text NOT NULL, target_id text NOT NULL, proof_id text NOT NULL UNIQUE, mode text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
