import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type HomeTab = "campus" | "following" | "groups";

/**
 * Home's feeds (Campus · Following · Groups · News) as a floating glass capsule that stays at the top while the feed
 * scrolls under it (scroll edge behind), with `right` beside it (messages). The active feed is an ink
 * pill; a light haptic on change.
 */
export function FeedTabs({ tab, tabs, label, right }: { tab: HomeTab | null; tabs: HomeTab[]; label: (x: HomeTab) => string; right?: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    // Sticks just under the status bar (the large title above already holds the safe area); its scroll edge reaches up
    // behind the status bar too.
    <div className="sticky top-[env(safe-area-inset-top,0px)] z-30">
      <div aria-hidden className="scroll-edge pointer-events-none absolute inset-x-0 -bottom-6 -top-[env(safe-area-inset-top,0px)]" />
      <div className="relative flex items-center gap-2 px-3 py-2">
        <div role="tablist" aria-label={t("home.feeds")} className="glass no-scrollbar flex min-w-0 flex-1 overflow-x-auto rounded-full p-1">
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
              className={cn(
                "hit h-9 flex-auto shrink-0 whitespace-nowrap rounded-full px-2 text-[13px]",
                x === tab ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-foreground",
              )}
            >
              {label(x)}
            </button>
          ))}
        </div>
        {right}
      </div>
    </div>
  );
}
