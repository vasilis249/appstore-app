import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Calendar, CircleHelp, Clapperboard, Cpu, House, Landmark, Laugh, Megaphone, Newspaper, PartyPopper, Pencil,
  Sparkles, Tag, TrendingUp, Trophy, type LucideIcon,
} from "lucide-react";
import { listSections, postKeys, type Section } from "@/lib/posts";

const ICONS: Record<string, LucideIcon> = {
  newspaper: Newspaper, cpu: Cpu, trophy: Trophy, "trending-up": TrendingUp,
  landmark: Landmark, clapperboard: Clapperboard, sparkles: Sparkles, laugh: Laugh,
  "book-open": BookOpen, pencil: Pencil, "party-popper": PartyPopper, house: House, calendar: Calendar, tag: Tag,
  "circle-help": CircleHelp, megaphone: Megaphone,
};

/**
 * Sections from the DB (rarely change) with localised names and icons: `sections` = the news ones (Επικαιρότητα, Tech…),
 * `campusSections` = the student ones (Μαθήματα, Εξεταστική…) used only on campus.
 */
export function useSections() {
  const { i18n } = useTranslation();
  const q = useQuery({ queryKey: postKeys.sections, queryFn: listSections, staleTime: 60 * 60_000 });
  const en = i18n.language.startsWith("en");
  const byId = new Map((q.data ?? []).map((s) => [s.id, s]));
  return {
    sections: (q.data ?? []).filter((s) => s.kind !== "campus"),
    campusSections: (q.data ?? []).filter((s) => s.kind === "campus"),
    name: (id: string) => {
      const s = byId.get(id);
      return s ? (en ? s.name_en : s.name_el) : id;
    },
    icon: (s: Section | string): LucideIcon => ICONS[(typeof s === "string" ? byId.get(s)?.icon : s.icon) ?? ""] ?? Sparkles,
  };
}
