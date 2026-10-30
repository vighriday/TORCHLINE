ALTER TABLE creators ADD COLUMN assignment_revision bigint NOT NULL DEFAULT 0 CHECK (assignment_revision >= 0);

CREATE FUNCTION bump_channel_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE creators SET assignment_revision=assignment_revision+1 WHERE id=NEW.channel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE creators SET assignment_revision=assignment_revision+1 WHERE id=OLD.channel_id;
    RETURN OLD;
  ELSIF (OLD.channel_id,OLD.world_id) IS DISTINCT FROM (NEW.channel_id,NEW.world_id) THEN
    UPDATE creators SET assignment_revision=assignment_revision+1 WHERE id IN (OLD.channel_id,NEW.channel_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER channel_assignment_changed AFTER INSERT OR UPDATE OR DELETE ON channel_slots
  FOR EACH ROW EXECUTE FUNCTION bump_channel_assignment();

CREATE FUNCTION bump_creator_authority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.assignment_revision := OLD.assignment_revision+1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER creator_authority_changed BEFORE UPDATE OF label,mode,connected,receive_opt_in ON creators
  FOR EACH ROW WHEN ((OLD.label,OLD.mode,OLD.connected,OLD.receive_opt_in) IS DISTINCT FROM
                    (NEW.label,NEW.mode,NEW.connected,NEW.receive_opt_in))
  EXECUTE FUNCTION bump_creator_authority();
