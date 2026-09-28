
-- 1. Update venue approval notification text
CREATE OR REPLACE FUNCTION public.notify_owner_on_venue_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.approved = true AND COALESCE(OLD.approved, false) = false THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.owner_id, 'venue_approved',
            'Το γήπεδό σου εγκρίθηκε',
            'Σε ευχαριστούμε που μας επέλεξες — το γήπεδό σου "' || NEW.name || '" εγκρίθηκε και είναι ορατό στους παίκτες.',
            jsonb_build_object('venue_id', NEW.id));
  END IF;
  IF NEW.approved = false
     AND NEW.rejection_reason IS NOT NULL
     AND COALESCE(OLD.rejection_reason, '') <> COALESCE(NEW.rejection_reason, '') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.owner_id, 'venue_rejected',
            'Το γήπεδό σου απορρίφθηκε',
            COALESCE(NEW.rejection_reason, 'Επικοινώνησε με τον διαχειριστή.'),
            jsonb_build_object('venue_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Add series_id to bookings for recurring bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS series_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_series_id ON public.bookings(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_player_date ON public.bookings(player_id, date);
