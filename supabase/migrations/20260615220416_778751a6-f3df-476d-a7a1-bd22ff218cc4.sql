GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;

GRANT SELECT ON public.courts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courts TO authenticated;
GRANT ALL ON public.courts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

WITH missing AS (
  SELECT
    v.id AS venue_id,
    v.sport,
    GREATEST(1, v.courts_count) AS needed,
    COALESCE(count(c.id), 0)::int AS existing
  FROM public.venues v
  LEFT JOIN public.courts c ON c.venue_id = v.id
  GROUP BY v.id, v.sport, v.courts_count
  HAVING COALESCE(count(c.id), 0)::int < GREATEST(1, v.courts_count)
)
INSERT INTO public.courts (venue_id, sport, name)
SELECT
  m.venue_id,
  m.sport,
  'Γήπεδο ' || (m.existing + gs.n)::text
FROM missing m
CROSS JOIN LATERAL generate_series(1, m.needed - m.existing) AS gs(n);