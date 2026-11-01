-- A revocable, read-only public link to one world's Chronicle, so communities can follow an Ark
-- after it leaves their channel. Only a hash is stored; the token travels in the URL fragment and
-- a request body, never in a path, query string, log line or Referer header.
--
-- Each creator holds at most one link per world. Rotating replaces only that creator's link, so a
-- receiving captain cannot silently break the link the sending community already shared.
CREATE TABLE world_shares (
  hash text PRIMARY KEY,
  world_id text NOT NULL REFERENCES worlds(id),
  created_by text NOT NULL REFERENCES creators(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, created_by)
);
