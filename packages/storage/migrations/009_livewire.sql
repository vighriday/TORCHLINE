-- Additive and inert for worlds without livewire-v0. Ballots never enter canonical JSONB.
CREATE TABLE livewire_stakes (
  id uuid PRIMARY KEY,
  world_id text NOT NULL REFERENCES worlds(id),
  channel_id text NOT NULL REFERENCES creators(id),
  chapter integer NOT NULL CHECK (chapter BETWEEN 0 AND 4),
  status text NOT NULL CHECK (status IN ('open','paused','locked','success','failure','cancelled','expired')),
  deadline_at timestamptz,
  navigation integer NOT NULL DEFAULT 0 CHECK (navigation BETWEEN 0 AND 10000),
  hull integer NOT NULL DEFAULT 0 CHECK (hull BETWEEN 0 AND 10000),
  oxygen integer NOT NULL DEFAULT 0 CHECK (oxygen BETWEEN 0 AND 10000),
  participants integer NOT NULL DEFAULT 0 CHECK (participants BETWEEN 0 AND 10000),
  ballot_revision integer NOT NULL DEFAULT 0,
  last_input_at timestamptz,
  UNIQUE(world_id,chapter),
  CHECK (navigation+hull+oxygen=participants)
);
CREATE INDEX livewire_due ON livewire_stakes(deadline_at) WHERE status IN ('open','locked');
CREATE TABLE livewire_ballots (
  stake_id uuid NOT NULL REFERENCES livewire_stakes(id) ON DELETE CASCADE,
  participant text NOT NULL CHECK (length(participant)=64),
  target text NOT NULL CHECK (target IN ('navigation','hull','oxygen')),
  provider_at timestamptz NOT NULL,
  provider_order text NOT NULL CHECK (length(provider_order)=30),
  delivery_key text NOT NULL,
  PRIMARY KEY(stake_id,participant)
);
