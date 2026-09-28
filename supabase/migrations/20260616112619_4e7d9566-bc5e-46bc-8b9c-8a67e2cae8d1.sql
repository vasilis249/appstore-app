
-- Notification trigger for bookings (online + phone) and for slot joins.

CREATE OR REPLACE FUNCTION public.notify_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
  v_player_name text;
  v_when text;
BEGIN
  IF NEW.type = 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT v.owner_id, v.name INTO v_owner, v_name
  FROM public.venues v WHERE v.id = NEW.venue_id;

  v_when := to_char(NEW.date, 'DD/MM') || ' ' || to_char(NEW.start_time, 'HH24:MI');

  -- Owner notification (online or phone)
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_owner,
      CASE WHEN NEW.type = 'phone' THEN 'booking_phone' ELSE 'booking_online' END,
      'Νέα κράτηση',
      'Νέα κράτηση στο ' || COALESCE(v_name,'γήπεδο') || ', ' || v_when || '.',
      jsonb_build_object('booking_id', NEW.id, 'venue_id', NEW.venue_id, 'date', NEW.date, 'start_time', NEW.start_time, 'type', NEW.type)
    );
  END IF;

  -- Player notification (online only — host of the booking)
  IF NEW.type = 'online' AND NEW.player_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.player_id,
      'booking_confirmed',
      'Η κράτησή σου επιβεβαιώθηκε',
      'Η κράτησή σου στο ' || COALESCE(v_name,'γήπεδο') || ', ' || v_when || ' επιβεβαιώθηκε.',
      jsonb_build_object('booking_id', NEW.id, 'venue_id', NEW.venue_id, 'date', NEW.date, 'start_time', NEW.start_time)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_booking ON public.bookings;
CREATE TRIGGER trg_notify_on_booking
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking();

-- Notify a player when they join an open game (slot booking)
CREATE OR REPLACE FUNCTION public.notify_on_open_game_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_date date;
  v_start time;
  v_when text;
BEGIN
  SELECT v.name, og.date, og.start_time
  INTO v_name, v_date, v_start
  FROM public.open_games og
  JOIN public.venues v ON v.id = og.venue_id
  WHERE og.id = NEW.open_game_id;

  v_when := to_char(v_date, 'DD/MM') || ' ' || to_char(v_start, 'HH24:MI');

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.player_id,
    'booking_confirmed',
    'Η συμμετοχή σου επιβεβαιώθηκε',
    'Η συμμετοχή σου στο ' || COALESCE(v_name,'γήπεδο') || ', ' || v_when || ' επιβεβαιώθηκε.',
    jsonb_build_object('open_game_id', NEW.open_game_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_open_game_join ON public.open_game_players;
CREATE TRIGGER trg_notify_on_open_game_join
AFTER INSERT ON public.open_game_players
FOR EACH ROW EXECUTE FUNCTION public.notify_on_open_game_join();

-- Default any new phone bookings without explicit payment_method to cash
UPDATE public.bookings SET payment_method = 'cash'
WHERE payment_method = 'pending' AND type = 'phone';
