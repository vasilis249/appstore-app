-- ΕΚΠΑ opens next to ΕΜΠ (user request 2026-10-18: Athens Medical School students are signing up). Other campuses
-- still wait for 100 verified students.
UPDATE public.universities SET min_students = 0 WHERE id = 'uoa';
