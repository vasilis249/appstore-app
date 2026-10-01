import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Briefcase, Calendar, CircleHelp, Clapperboard, Cpu, GraduationCap, House, Landmark, Laugh, Megaphone,
  Newspaper, PartyPopper, Pencil, Plane, Sparkles, Tag, TrendingUp, Trophy, Wallet, type LucideIcon,
} from "lucide-react";
import { listSections, postKeys, type Section } from "@/lib/posts";

const ICONS: Record<string, LucideIcon> = {
  newspaper: Newspaper, cpu: Cpu, trophy: Trophy, "trending-up": TrendingUp,
  landmark: Landmark, clapperboard: Clapperboard, sparkles: Sparkles, laugh: Laugh,
  "book-open": BookOpen, pencil: Pencil, "party-popper": PartyPopper, house: House, calendar: Calendar, tag: Tag,
  "circle-help": CircleHelp, megaphone: Megaphone,
  "graduation-cap": GraduationCap, wallet: Wallet, plane: Plane, briefcase: Briefcase,
};

/**
 * Sections from the DB (rarely change) with localised names and icons: `sections` = the student news ones (Πανεπιστήμια,
 * Παροχές…; the old general ones are hidden), `campusSections` = the campus ones (Μαθήματα, Εξεταστική…).
 * `name` / `icon` still know hidden sections, for old group voices.
 */
export function useSections() {
  const { i18n } = useTranslation();
  const q = useQuery({ queryKey: postKeys.sections, queryFn: listSections, staleTime: 60 * 60_000 });
  const en = i18n.language.startsWith("en");
  const byId = new Map((q.data ?? []).map((s) => [s.id, s]));
  return {
    sections: (q.data ?? []).filter((s) => s.kind !== "campus" && !s.hidden),
    campusSections: (q.data ?? []).filter((s) => s.kind === "campus"),
    name: (id: string) => {
      const s = byId.get(id);
      return s ? (en ? s.name_en : s.name_el) : id;
    },
    icon: (s: Section | string): LucideIcon => ICONS[(typeof s === "string" ? byId.get(s)?.icon : s.icon) ?? ""] ?? Sparkles,
  };
}
