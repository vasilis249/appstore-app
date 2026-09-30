// Campus identity: universities, their schools, verified students (NTUA first).
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export interface University {
  id: string;
  name_el: string;
  name_en: string;
  short_el: string;
  short_en: string;
  email_domains: string[];
  open: boolean;
}
export interface Department {
  id: string;
  university_id: string;
  name_el: string;
  name_en: string;
  short_el: string;
  short_en: string;
  years: number;
}
/** The campus fields every profile row carries. */
export interface StudentFields {
  university_id?: string | null;
  department_id?: string | null;
  study_year?: number | null;
}
export const STUDENT_COLUMNS = "university_id, department_id, study_year";

export const campusKeys = { all: ["campus"] as const };

/** Universities and schools (static data, loaded once). */
export function useCampus() {
  const { i18n } = useTranslation();
  const q = useQuery({
    queryKey: campusKeys.all,
    staleTime: Infinity,
    queryFn: async () => {
      const [u, d] = await Promise.all([
        supabase.from("universities").select("id, name_el, name_en, short_el, short_en, email_domains, open").order("position"),
        supabase.from("departments").select("id, university_id, name_el, name_en, short_el, short_en, years").order("position"),
      ]);
      if (u.error) throw new Error(u.error.message);
      if (d.error) throw new Error(d.error.message);
      return { universities: u.data as University[], departments: d.data as Department[] };
    },
  });
  const en = i18n.language.startsWith("en");
  const universities = q.data?.universities ?? [];
  const departments = q.data?.departments ?? [];
  const uni = (id?: string | null) => universities.find((x) => x.id === id);
  const dep = (id?: string | null) => departments.find((x) => x.id === id);
  return {
    loaded: !!q.data,
    universities,
    departments,
    uni,
    dep,
    uniName: (id?: string | null) => (uni(id) ? (en ? uni(id)!.name_en : uni(id)!.name_el) : ""),
    depName: (id?: string | null) => (dep(id) ? (en ? dep(id)!.name_en : dep(id)!.name_el) : ""),
    /** "ΕΜΠ · ΗΜΜΥ" (or just "ΕΜΠ"), empty for non-students. */
    label: (p: StudentFields | null | undefined) => {
      const u = uni(p?.university_id);
      if (!u) return "";
      const d = dep(p?.department_id);
      return [en ? u.short_en : u.short_el, d && (en ? d.short_en : d.short_el)].filter(Boolean).join(" · ");
    },
  };
}

export type VerifyResult = "ok" | "bad_code" | "expired" | "too_many" | "no_code" | "email_taken";

export async function verifyStudentCode(code: string): Promise<VerifyResult> {
  const { data, error } = await supabase.rpc("verify_student_code", { p_code: code });
  if (error) throw new Error(error.message);
  return data as VerifyResult;
}

export async function setStudentInfo(department: string | null, year: number | null) {
  // null clears the field (the generated types only know non-null arguments)
  const { error } = await supabase.rpc("set_student_info", { p_department: department as string, p_year: year as number });
  if (error) throw new Error(error.message);
}

export async function clearStudentIdentity() {
  const { error } = await supabase.rpc("clear_student_identity");
  if (error) throw new Error(error.message);
}
