DO $$
DECLARE
  c RECORD;
  v_dur interval;
  v_start time;
  v_close time := '23:00';
  v_open  time := '08:00';
  v_dow int;
  v_slot_end time;
BEGIN
  FOR c IN
    SELECT co.id AS court_id, co.sport::text AS sport
    FROM public.courts co
    LEFT JOIN public.court_slots cs ON cs.court_id = co.id
    WHERE cs.id IS NULL
    GROUP BY co.id, co.sport
  LOOP
    v_dur := CASE WHEN c.sport = 'padel' THEN interval '90 minutes' ELSE interval '60 minutes' END;
    FOR v_dow IN 0..6 LOOP
      v_start := v_open;
      LOOP
        v_slot_end := (v_start + v_dur);
        EXIT WHEN v_slot_end <= v_start OR v_slot_end > v_close;
        INSERT INTO public.court_slots (court_id, day_of_week, start_time, end_time)
        VALUES (c.court_id, v_dow, v_start, v_slot_end)
        ON CONFLICT DO NOTHING;
        v_start := v_slot_end;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;