import { Link } from "@tanstack/react-router";
import { useSections } from "@/hooks/use-sections";
import { cn } from "@/lib/utils";

/** Horizontal, scrollable section chips (the active one is white). */
export function SectionChips({ active }: { active?: string }) {
  const { sections, name, icon } = useSections();
  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
      {sections.map((s) => {
        const Icon = icon(s);
        const on = s.id === active;
        return (
          <Link
            key={s.id}
            to="/s/$sectionId"
            params={{ sectionId: s.id }}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold",
              on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {name(s.id)}
          </Link>
        );
      })}
    </nav>
  );
}
