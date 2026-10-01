import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type HomeTab = "campus" | "following" | "groups" | "news";

/**
 * Home's feeds as text tabs under the large title (Campus · Following · Groups · News): the active one in ink, a
 * short line glides under it (iOS spring), a light haptic on change.
 */
export function FeedTabs({ tab, tabs, label }: { tab: HomeTab | null; tabs: HomeTab[]; label: (x: HomeTab) => string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const i = tab ? tabs.indexOf(tab) : -1;
  return (
    <div role="tablist" aria-label={t("home.feeds")} className="relative grid border-b border-border" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((x) => (
        <button
          key={x}
          type="button"
          role="tab"
          aria-selected={x === tab}
          onClick={() => {
            if (x !== tab) haptic("light");
            void navigate({ to: "/", search: { tab: x }, replace: true });
          }}
          className={cn("h-11 truncate px-1 text-callout", x === tab ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}
        >
          {label(x)}
        </button>
      ))}
      <span
        aria-hidden
        className={cn("nav-pill pointer-events-none absolute -bottom-px left-0 flex h-0.5 justify-center", i < 0 && "opacity-0")}
        style={{ width: `${100 / tabs.length}%`, transform: `translateX(${Math.max(i, 0) * 100}%)` }}
      >
        <span className="h-0.5 w-8 rounded-full bg-foreground" />
      </span>
    </div>
  );
}
