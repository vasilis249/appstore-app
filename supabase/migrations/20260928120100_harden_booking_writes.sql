-- Enforce booking rules in the database, not only in the web server.
--
-- Before this migration create_slot_booking / create_whole_booking ran as
-- SECURITY INVOKER, so the bookings RLS policies had to let players INSERT and
-- UPDATE their own rows directly. With the public anon key and their own JWT a
-- player could therefore skip the RPCs and write e.g. price = 0, type = 'closed',
-- a past date, or move an existing booking to another court/time.
--
-- Now:
--   * the two RPCs run as SECURITY DEFINER (they already derive the user from
--     auth.uid() and compute price/status/type themselves);
--   * a guard trigger lets a plain player (not venue owner, not admin), writing
--     through PostgREST as role "authenticated", only cancel their own booking.
--     Everything else must go through the RPCs or the server (service_role).
-- Double bookings stay blocked by the bookings_no_overlap exclusion constraint.

ALTER FUNCTION public.create_slot_booking(uuid, date, time, numeric, integer, uuid) SECURITY DEFINER;
ALTER FUNCTION public.create_whole_booking(uuid, date, time, numeric, uuid) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time, numeric, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time, numeric, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time, numeric, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_player_booking_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER -- must stay INVOKER: current_user below identifies the writer
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _venue uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.venue_id ELSE NEW.venue_id END;
  _ignored text[] := ARRAY['status', 'cancelled_at', 'updated_at'];
BEGIN
  -- Only direct client writes are restricted. Inside SECURITY DEFINER functions
  -- current_user is the function owner, and the web server uses service_role,
  -- so both skip this check.
  IF current_user <> 'authenticated' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Venue owners and admins keep their existing rights (phone/closed bookings, edits).
  IF public.has_role(_uid, 'admin')
     OR EXISTS (SELECT 1 FROM venues v WHERE v.id = _venue AND v.owner_id = _uid)
     OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM venues v WHERE v.id = OLD.venue_id AND v.owner_id = _uid)) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Bookings must be created through create_slot_booking / create_whole_booking'
      USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Players cannot delete bookings; cancel them instead'
      USING ERRCODE = '42501';
  END IF;

  -- UPDATE: a player may only move their own active booking to 'cancelled'.
  IF OLD.player_id IS DISTINCT FROM _uid
     OR NEW.status IS DISTINCT FROM 'cancelled'
     OR OLD.status IN ('cancelled', 'completed')
     OR (to_jsonb(NEW) - _ignored) IS DISTINCT FROM (to_jsonb(OLD) - _ignored) THEN
    RAISE EXCEPTION 'Players can only cancel their own active bookings'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_player_booking_writes() FROM PUBLIC, anon, authenticated;

-- Name sorts before the other BEFORE triggers (bookings_set_cancelled_at,
-- trg_bookings_updated), so it sees the row exactly as the client sent it.
DROP TRIGGER IF EXISTS bookings_guard_player_writes ON public.bookings;
CREATE TRIGGER bookings_guard_player_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_booking_writes();
