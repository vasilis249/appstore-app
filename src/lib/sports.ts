import type { Database } from "@/integrations/supabase/types";

export type Sport = Database["public"]["Enums"]["sport"];

export const SPORTS: { id: Sport; label: string; tokenClass: string }[] = [
  { id: "padel",        label: "Padel",        tokenClass: "bg-padel/15 text-padel border-padel/30" },
  { id: "tennis",       label: "Tennis",       tokenClass: "bg-tennis/15 text-tennis border-tennis/30" },
  { id: "basketball",   label: "Μπάσκετ",      tokenClass: "bg-basketball/15 text-basketball border-basketball/30" },
  { id: "football",     label: "Ποδόσφαιρο",   tokenClass: "bg-football/15 text-football border-football/30" },
  { id: "volleyball",   label: "Βόλεϊ",        tokenClass: "bg-volleyball/15 text-volleyball border-volleyball/30" },
  { id: "beach_volley", label: "Beach Volley", tokenClass: "bg-beach/15 text-beach border-beach/30" },
];


export const SPORT_IDS: Sport[] = SPORTS.map((s) => s.id);

/**
 * Πόσοι παίκτες παίζουν συνολικά σε ένα γήπεδο για κάθε άθλημα.
 * Χρησιμοποιείται για τον υπολογισμό:
 *   τιμή ατομικής θέσης = τιμή ολόκληρου γηπέδου ÷ players
 *   τιμή ολόκληρου γηπέδου = τιμή ατομικής θέσης × players
 */
export const PLAYERS_PER_SPORT: Record<Sport, number> = {
  padel: 4,
  tennis: 4,
  basketball: 10,
  football: 10,
  volleyball: 12,
  beach_volley: 4,
};

export function playersFor(sport: Sport): number {
  return PLAYERS_PER_SPORT[sport] ?? 4;
}

export function deriveSlotPrice(base: number, sport: Sport): number {
  const n = playersFor(sport);
  if (!base || base <= 0 || n <= 0) return 0;
  return Math.round((base / n) * 100) / 100;
}

export function deriveBasePrice(slot: number, sport: Sport): number {
  const n = playersFor(sport);
  if (!slot || slot <= 0 || n <= 0) return 0;
  return Math.round(slot * n * 100) / 100;
}

