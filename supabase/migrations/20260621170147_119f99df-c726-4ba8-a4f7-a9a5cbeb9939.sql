
CREATE OR REPLACE FUNCTION public.notify_on_open_game_join()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_date date;
  v_start time;
  v_when text;
  v_host uuid;
  v_venue uuid;
  v_player_name text;
BEGIN
  SELECT v.name, og.date, og.start_time, og.host_id, og.venue_id
  INTO v_name, v_date, v_start, v_host, v_venue
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

  IF v_host IS NOT NULL AND v_host <> NEW.player_id THEN
    SELECT p.full_name INTO v_player_name
    FROM public.profiles p
    WHERE p.user_id = NEW.player_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_host,
      'open_game_join',
      'Νέος παίκτης στο παιχνίδι σου',
      COALESCE(v_player_name, 'Ένας παίκτης') || ' μπήκε στο παιχνίδι σου στο ' || COALESCE(v_name,'γήπεδο') || ', ' || v_when || '.',
      jsonb_build_object('open_game_id', NEW.open_game_id, 'venue_id', v_venue)
    );
  END IF;

  RETURN NEW;
END;
$function$;
