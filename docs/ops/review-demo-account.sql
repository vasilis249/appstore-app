-- App Review demo account (the reviewers can't receive a code at an academic address, so they sign in with
-- «Έχω λογαριασμό με κωδικό πρόσβασης»). FIRST create the user in Dashboard → Authentication → Users → Add user →
-- Create new user: email review@example.com, a password, «Auto Confirm User» ticked. THEN run this in the SQL Editor:
-- it makes the account a verified ΕΜΠ student (ΗΜΜΥ, 3rd year), so it passes the student gate and has a campus.
UPDATE public.profiles p
SET full_name = 'App Review', university_id = 'ntua', department_id = 'ntua-ece', study_year = 3, student_verified_at = now()
FROM auth.users u
WHERE u.id = p.id AND lower(u.email) = 'review@example.com'
RETURNING p.id, p.username, p.university_id, p.department_id, p.study_year;
