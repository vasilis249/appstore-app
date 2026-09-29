import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Clapperboard, Cpu, Landmark, Laugh, Newspaper, Sparkles, TrendingUp, Trophy, type LucideIcon,
} from "lucide-react";
import { listSections, postKeys, type Section } from "@/lib/posts";

const ICONS: Record<string, LucideIcon> = {
  newspaper: Newspaper, cpu: Cpu, trophy: Trophy, "trending-up": TrendingUp,
  landmark: Landmark, clapperboard: Clapperboard, sparkles: Sparkles, laugh: Laugh,
};

/** Sections from the DB (rarely change) with localised names and icons. */
export function useSections() {
  const { i18n } = useTranslation();
  const q = useQuery({ queryKey: postKeys.sections, queryFn: listSections, staleTime: 60 * 60_000 });
  const en = i18n.language.startsWith("en");
  const byId = new Map((q.data ?? []).map((s) => [s.id, s]));
  return {
    sections: q.data ?? [],
    name: (id: string) => {
      const s = byId.get(id);
      return s ? (en ? s.name_en : s.name_el) : id;
    },
    icon: (s: Section | string): LucideIcon => ICONS[(typeof s === "string" ? byId.get(s)?.icon : s.icon) ?? ""] ?? Sparkles,
  };
}
