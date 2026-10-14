-- No abbreviations for universities (user request 2026-10-13): every place that showed the short name (post cards,
-- profiles, Home header, search, invite page, admin) now shows the full name — short_el / short_en become the names.
UPDATE public.universities SET short_el = name_el, short_en = name_en
WHERE short_el IS DISTINCT FROM name_el OR short_en IS DISTINCT FROM name_en;

-- Auto group names drop the university (the full name would pass the 60-character limit; these groups are only for
-- that university's students, and the description names it in full): "Πληροφορική · 3ο έτος". A 2-letter department
-- short (IT, AI, HA) gives way to the department's full name, so a name is never under 3 characters.
CREATE OR REPLACE FUNCTION private.auto_group_name(p_department text, p_year int)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT left(concat_ws(' · ', CASE WHEN char_length(d.short_el) < 3 THEN d.name_el ELSE d.short_el END,
                        private.year_label(p_year)), 60)
  FROM public.departments d WHERE d.id = p_department
$$;
REVOKE EXECUTE ON FUNCTION private.auto_group_name(text, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.auto_group(p_department text, p_year int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  gid uuid;
  d public.departments;
BEGIN
  SELECT id INTO gid FROM public.groups WHERE auto AND department_id = p_department AND coalesce(study_year, 0) = coalesce(p_year, 0);
  IF FOUND THEN RETURN gid; END IF;
  SELECT * INTO d FROM public.departments WHERE id = p_department;
  INSERT INTO public.groups (name, description, section_id, privacy, auto, university_id, department_id, study_year)
  VALUES (
    private.auto_group_name(p_department, p_year),
    left(private.auto_group_description(p_department, p_year), 300),
    'courses', 'private', true, d.university_id, d.id, p_year)
  ON CONFLICT DO NOTHING
  RETURNING id INTO gid;
  IF gid IS NULL THEN  -- made at the same moment by someone else
    SELECT id INTO gid FROM public.groups WHERE auto AND department_id = p_department AND coalesce(study_year, 0) = coalesce(p_year, 0);
  END IF;
  RETURN gid;
END $$;

-- Existing auto groups: new names, descriptions with the full university name.
UPDATE public.groups g SET
  name = private.auto_group_name(g.department_id, g.study_year),
  description = left(private.auto_group_description(g.department_id, g.study_year), 300)
WHERE g.auto AND g.department_id IS NOT NULL;
