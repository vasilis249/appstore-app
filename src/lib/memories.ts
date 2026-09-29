import { supabase } from "@/integrations/supabase/client";

/** One of your own voice posts (top-level, with audio). */
export interface Memory {
  id: string;
  day: string; // YYYY-MM-DD in local time
  title: string | null;
  section_id: string;
  audio_path: string;
  duration_ms: number;
  created_at: string;
}

export const memoryKeys = { list: ["posts", "memories"] as const };

export function toMoment(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function listMemories(uid: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, section_id, audio_path, duration_ms, created_at")
    .eq("author_id", uid)
    .is("reply_to", null)
    .not("audio_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    section_id: p.section_id,
    audio_path: p.audio_path!,
    duration_ms: p.duration_ms ?? 0,
    created_at: p.created_at,
    day: toMoment(new Date(p.created_at)),
  }));
}

/** "2026-09-29" → local Date (no timezone shift). */
export function momentDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthKey(day: string): string {
  return day.slice(0, 7);
}

// Intl gives the genitive in Greek ("Σεπτεμβρίου"); a title needs the nominative.
const EL_MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

/** "Σεπτέμβριος 2026" / "September 2026". */
export function monthTitle(year: number, monthIndex: number, locale: string): string {
  if (locale.startsWith("el")) return `${EL_MONTHS[monthIndex]} ${year}`;
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(year, monthIndex, 1));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
