
-- Seed demo venues, courts. No open_games (require real user host).
INSERT INTO public.venues (name, sport, area, address, lat, lng, base_price_per_hour, rating, reviews_count, courts_count, amenities, photo_url)
VALUES
  ('Padel Point Glyfada', 'padel', 'Γλυφάδα', 'Λεωφ. Ποσειδώνος 23, Γλυφάδα', 37.8650, 23.7540, 28, 4.8, 124, 4, ARRAY['parking','showers','lockers','cafe','lighting','equipment_rental'], NULL),
  ('Acropolis Padel Club', 'padel', 'Νέο Ψυχικό', 'Κηφισίας 112, Ψυχικό', 38.0050, 23.7770, 32, 4.6, 88, 6, ARRAY['parking','showers','lockers','wifi','lighting'], NULL),
  ('Athens Tennis Academy', 'tennis', 'Μαρούσι', 'Σπύρου Λούη 5, Μαρούσι', 38.0440, 23.7870, 25, 4.7, 210, 8, ARRAY['parking','showers','lockers','cafe','equipment_rental','coaching'], NULL),
  ('Vouliagmeni Tennis Club', 'tennis', 'Βουλιαγμένη', 'Απόλλωνος 8, Βουλιαγμένη', 37.8130, 23.7770, 35, 4.9, 156, 5, ARRAY['parking','showers','lockers','cafe','wifi','lighting'], NULL),
  ('Hoops Court Kallithea', 'basketball', 'Καλλιθέα', 'Δοϊράνης 181, Καλλιθέα', 37.9550, 23.7000, 18, 4.4, 67, 2, ARRAY['parking','lighting','lockers'], NULL),
  ('Piraeus Street Ball', 'basketball', 'Πειραιάς', 'Ακτή Μιαούλη 20, Πειραιάς', 37.9420, 23.6470, 16, 4.3, 45, 3, ARRAY['lighting','lockers'], NULL),
  ('Goal! 5x5 Peristeri', 'football', 'Περιστέρι', 'Παναγή Τσαλδάρη 90, Περιστέρι', 38.0140, 23.6920, 45, 4.5, 178, 4, ARRAY['parking','showers','lockers','cafe','lighting','equipment_rental'], NULL),
  ('Marina Soccer Arena', 'football', 'Άλιμος', 'Λεωφ. Αλίμου 5, Άλιμος', 37.9120, 23.7150, 50, 4.7, 145, 6, ARRAY['parking','showers','lockers','cafe','wifi','lighting'], NULL);

-- Create courts for each venue based on courts_count
INSERT INTO public.courts (venue_id, name, sport)
SELECT v.id, 'Κορτ ' || gs::text, v.sport
FROM public.venues v
CROSS JOIN LATERAL generate_series(1, v.courts_count) AS gs;
