
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
UPDATE public.venues SET approved = true WHERE approved = false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;

-- Tighten venue SELECT policy
DROP POLICY IF EXISTS "Venues viewable" ON public.venues;
DROP POLICY IF EXISTS "Venues are viewable by everyone" ON public.venues;
CREATE POLICY "Venues viewable" ON public.venues FOR SELECT
USING (
  approved = true
  OR auth.uid() = owner_id
  OR public.has_role(auth.uid(), 'admin')
);

-- Profile visibility: hide disabled from others
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable" ON public.profiles FOR SELECT
USING (
  disabled = false
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
);

-- Admin manage all venues / profiles / roles
DROP POLICY IF EXISTS "Admins manage venues" ON public.venues;
CREATE POLICY "Admins manage venues" ON public.venues FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read roles" ON public.user_roles;
CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
