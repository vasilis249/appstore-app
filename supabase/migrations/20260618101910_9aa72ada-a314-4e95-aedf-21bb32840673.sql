
-- 1) Make new venues default to NOT approved
ALTER TABLE public.venues ALTER COLUMN approved SET DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2) court_closures table (per-court time blocks)
CREATE TABLE IF NOT EXISTS public.court_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  -- Either a specific date (one-off) OR a weekday (0..6 = Sun..Sat) for recurring weekly block.
  date date,
  weekday smallint,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((date IS NOT NULL) OR (weekday IS NOT NULL)),
  CHECK (end_time > start_time),
  CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6))
);
CREATE INDEX IF NOT EXISTS idx_court_closures_court ON public.court_closures(court_id);
CREATE INDEX IF NOT EXISTS idx_court_closures_date ON public.court_closures(court_id, date);

GRANT SELECT ON public.court_closures TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.court_closures TO authenticated;
GRANT ALL ON public.court_closures TO service_role;

ALTER TABLE public.court_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Closures viewable by everyone" ON public.court_closures;
CREATE POLICY "Closures viewable by everyone" ON public.court_closures
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners manage closures" ON public.court_closures;
CREATE POLICY "Owners manage closures" ON public.court_closures
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON v.id = c.venue_id
      WHERE c.id = court_closures.court_id
        AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON v.id = c.venue_id
      WHERE c.id = court_closures.court_id
        AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

DROP TRIGGER IF EXISTS update_court_closures_updated_at ON public.court_closures;
CREATE TRIGGER update_court_closures_updated_at
  BEFORE UPDATE ON public.court_closures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Notify admins when a new venue is submitted as pending
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_venue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT ur.user_id,
         'venue_pending',
         'Νέο γήπεδο προς έγκριση',
         NEW.name || ' (' || NEW.area || ')',
         jsonb_build_object('venue_id', NEW.id)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_venue ON public.venues;
CREATE TRIGGER trg_notify_admins_new_venue
  AFTER INSERT ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_venue();

-- 4) Notify owner when approval status changes
CREATE OR REPLACE FUNCTION public.notify_owner_on_venue_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Approved transition
  IF NEW.approved = true AND COALESCE(OLD.approved, false) = false THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.owner_id, 'venue_approved',
            'Το γήπεδό σου εγκρίθηκε',
            NEW.name || ' είναι πλέον ορατό στους παίκτες.',
            jsonb_build_object('venue_id', NEW.id));
  END IF;
  -- Rejected transition (rejection_reason newly set, still not approved)
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
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_venue_status ON public.venues;
CREATE TRIGGER trg_notify_owner_venue_status
  AFTER UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_venue_status();

-- 5) Add court_closures to realtime publication (best-effort; ignore if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.court_closures;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;
