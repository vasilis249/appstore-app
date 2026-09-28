
CREATE TABLE public.court_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_slots_time_order CHECK (end_time > start_time),
  UNIQUE (court_id, day_of_week, start_time)
);

CREATE INDEX court_slots_court_day_idx ON public.court_slots (court_id, day_of_week);

GRANT SELECT ON public.court_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_slots TO authenticated;
GRANT ALL ON public.court_slots TO service_role;

ALTER TABLE public.court_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read court slots"
  ON public.court_slots FOR SELECT
  USING (true);

CREATE POLICY "Owners manage their court slots"
  ON public.court_slots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON v.id = c.venue_id
      WHERE c.id = court_slots.court_id
        AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON v.id = c.venue_id
      WHERE c.id = court_slots.court_id
        AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE TRIGGER court_slots_updated_at
  BEFORE UPDATE ON public.court_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from venue_hours using seconds-of-day to avoid midnight wrap
DO $$
DECLARE
  r record;
  cur_s int;
  end_s int;
  slot_s int;
  next_s int;
BEGIN
  FOR r IN
    SELECT c.id AS court_id, c.sport, vh.day_of_week, vh.open_time, vh.close_time
    FROM public.courts c
    JOIN public.venue_hours vh ON vh.venue_id = c.venue_id
    WHERE vh.is_open = true
  LOOP
    slot_s := CASE WHEN r.sport = 'padel' THEN 5400 ELSE 3600 END;
    cur_s := EXTRACT(EPOCH FROM r.open_time)::int;
    end_s := EXTRACT(EPOCH FROM r.close_time)::int;
    IF end_s = 0 THEN end_s := 86400; END IF; -- treat 00:00 as 24:00
    LOOP
      next_s := cur_s + slot_s;
      EXIT WHEN next_s > end_s OR next_s > 86399;
      INSERT INTO public.court_slots (court_id, day_of_week, start_time, end_time)
      VALUES (
        r.court_id,
        r.day_of_week,
        (cur_s || ' seconds')::interval::time,
        (next_s || ' seconds')::interval::time
      )
      ON CONFLICT DO NOTHING;
      cur_s := next_s;
    END LOOP;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.venue_hours CASCADE;
