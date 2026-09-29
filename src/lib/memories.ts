import { supabase } from "@/integrations/supabase/client";

/** One of your own daily posts (you can always replay your own). */
export interface Memory {
  id: string;
  moment: string; // YYYY-MM-DD (the day of the prompt)
  audio_path: string;
  duration_ms: number;
  late: boolean;
  created_at: string;
}

export const memoryKeys = { list: ["daily", "memories"] as const };

export async function listMemories(uid: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("daily_posts")
    .select("id, moment, audio_path, duration_ms, late, created_at")
    .eq("user_id", uid)
    .order("moment", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** "2026-09-29" → local Date (no timezone shift). */
export function momentDate(moment: string): Date {
  const [y, m, d] = moment.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthKey(moment: string): string {
  return moment.slice(0, 7);
}

// Intl gives the genitive in Greek ("Σεπτεμβρίου"); a title needs the nominative.
const EL_MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

/** "Σεπτέμβριος 2026" / "September 2026". */
export function monthTitle(year: number, monthIndex: number, locale: string): string {
  if (locale.startsWith("el")) return `${EL_MONTHS[monthIndex]} ${year}`;
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(year, monthIndex, 1));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function toMoment(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
