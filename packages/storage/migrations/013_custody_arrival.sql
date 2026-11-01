-- A receiving custodian needs to know what they just inherited, and the moment it stops being news.
--
-- The world state version at arrival is the boundary: the briefing is current while the receiver has
-- not yet changed the world, and it clears itself on their first command. Existing rows keep NULL,
-- which the projection reads as "no briefing" rather than inventing one for a historical transfer.
ALTER TABLE custody_events ADD COLUMN state_version integer;