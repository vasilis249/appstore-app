import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, GraduationCap, Newspaper, UserRoundCheck, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type HomeTab = "campus" | "following" | "groups" | "news";
const ICON = { campus: GraduationCap, following: UserRoundCheck, groups: Users, news: Newspaper } as const;

/**
 * The big title of Home doubles as the feed picker (like "For you ⌄"): tap → a small menu with Campus · Following ·
 * Groups · News, the current one ticked.
 */
export function FeedSwitcher({ tab, tabs, label }: { tab: HomeTab | null; tabs: HomeTab[]; label: (x: HomeTab) => string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("home.pickFeed", { feed: tab ? label(tab) : "" })}
        className="flex items-center gap-1 rounded-lg px-1 text-[22px] font-extrabold leading-none tracking-[-0.02em] outline-none data-[state=open]:opacity-70"
      >
        <span className="max-w-[52vw] truncate">{tab ? label(tab) : " "}</span>
        <ChevronDown className="mt-0.5 h-5 w-5 transition-transform duration-300 [[data-state=open]_&]:rotate-180" strokeWidth={2.6} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" sideOffset={8} className="min-w-[228px] rounded-2xl border-0 bg-popover p-1.5 shadow-float">
        {tabs.map((x) => {
          const Icon = ICON[x];
          return (
            <DropdownMenuItem
              key={x}
              onSelect={() => void navigate({ to: "/", search: { tab: x }, replace: true })}
              className={cn("h-11 justify-between rounded-xl px-3 text-[15px] font-semibold focus:bg-secondary", x === tab && "text-foreground")}
            >
              <span className="flex items-center gap-3">
                <Icon className="!size-5" strokeWidth={x === tab ? 2.4 : 1.9} />
                {label(x)}
              </span>
              {x === tab && <Check className="!size-4 text-primary" strokeWidth={3} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
