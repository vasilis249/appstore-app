-- Every campus is open: no "opens at N verified students" any more (user decision 2026-11-04).
-- The column stays (campus_status / admin_campuses / admin_metrics return it), always 0; nobody can raise it again.
UPDATE public.universities SET min_students = 0 WHERE min_students <> 0;
DROP FUNCTION IF EXISTS public.admin_set_campus(text, int);
