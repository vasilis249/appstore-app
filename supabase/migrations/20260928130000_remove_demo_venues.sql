-- Remove the 8 demo venues seeded by 20260614224150_*. They have no owner and
-- fake data; courts, bookings, open games, photos and equipment cascade.
-- Matching on name AND owner_id IS NULL leaves any real venue with the same name alone.
DELETE FROM public.venues
WHERE owner_id IS NULL
  AND name IN (
    'Padel Point Glyfada',
    'Acropolis Padel Club',
    'Athens Tennis Academy',
    'Vouliagmeni Tennis Club',
    'Hoops Court Kallithea',
    'Piraeus Street Ball',
    'Goal! 5x5 Peristeri',
    'Marina Soccer Arena'
  );
