import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, Mic, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

/**
 * Floating pill nav (BeReal-like): Home, Friends, the white record button in the
 * middle, Memories, Profile (avatar). Labels under icons; active tab gets a pill.
 */
export function BottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  if (!user) return null;

  const name = (user.user_metadata?.full_name as string | undefined) || user.email || "?";
  const item =
    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium text-foreground/90 transition-colors";
  const active = { className: "bg-secondary text-foreground" };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-center rounded-full border border-border bg-[#141415]/95 p-1 shadow-lg backdrop-blur">
        <li>
          <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
            <Home className="h-6 w-6" fill="currentColor" strokeWidth={1.5} />
            <span>{t("tabs.feed")}</span>
          </Link>
        </li>
        <li>
          <Link to="/friends" className={item} activeProps={active}>
            <Users className="h-6 w-6" strokeWidth={2} />
            <span>{t("tabs.friends")}</span>
          </Link>
        </li>
        <li className="flex justify-center">
          <Link
            to="/record"
            aria-label={t("tabs.record")}
            className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
            activeProps={{ className: "ring-4 ring-coral/60" }}
          >
            <Mic className="h-7 w-7" strokeWidth={2.2} />
          </Link>
        </li>
        <li>
          <Link to="/memories" className={item} activeProps={active}>
            <CalendarDays className="h-6 w-6" strokeWidth={2} />
            <span>{t("tabs.memories")}</span>
          </Link>
        </li>
        <li>
          <Link to="/profile" className={item} activeProps={active}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted-foreground/40 text-[11px] font-bold">
              {name.charAt(0).toUpperCase()}
            </span>
            <span>{t("tabs.profile")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
