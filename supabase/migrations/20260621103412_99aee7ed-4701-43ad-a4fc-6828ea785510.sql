
-- Auto-handle open_games when the host's booking gets cancelled.
CREATE OR REPLACE FUNCTION public.handle_booking_cancelled_open_game()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _og_id uuid;
  _new_host uuid;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT id INTO _og_id FROM public.open_games WHERE booking_id = NEW.id LIMIT 1;
    IF _og_id IS NOT NULL THEN
      SELECT player_id INTO _new_host
      FROM public.open_game_players
      WHERE open_game_id = _og_id
      ORDER BY joined_at ASC
      LIMIT 1;

      IF _new_host IS NOT NULL THEN
        -- Promote oldest joiner to host; keep the court reservation alive.
        UPDATE public.bookings
          SET status = 'confirmed',
              player_id = _new_host,
              cancelled_at = NULL
          WHERE id = NEW.id;
        UPDATE public.open_games SET host_id = _new_host WHERE id = _og_id;
        DELETE FROM public.open_game_players
          WHERE open_game_id = _og_id AND player_id = _new_host;
      ELSE
        -- No remaining players: tear down the open game entirely.
        DELETE FROM public.open_games WHERE id = _og_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_cancelled_open_game ON public.bookings;
CREATE TRIGGER trg_bookings_cancelled_open_game
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_cancelled_open_game();
