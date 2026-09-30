import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Home, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-my-profile";
import { UserAvatar } from "@/components/user-avatar";
import { NavRecordButton } from "@/components/voice/nav-record-button";

/**
 * Floating pill nav: Home, Search, the round voice button in the middle (tap = compose, hold = push to talk),
 * Memories, Profile (avatar). Labels under icons; active tab gets a pill.
 */
/** Sign-in / sign-up / password pages (also shown right after sign-up, while already signed in). */
export const AUTH_PATHS = /^\/(auth|forgot-password|reset-password)(\/|$)/;

export function BottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const me = useMyProfile();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // A conversation has its own composer at the bottom; sign-in steps have their own button.
  // The composer is a focused screen (its own push-to-talk button and Publish at the bottom).
  if (!user || /^\/(messages|talk)\/./.test(path) || AUTH_PATHS.test(path) || path === "/record") return null;

  const name = me.data?.full_name || me.data?.username || (user.user_metadata?.full_name as string | undefined) || "?";
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
          <Link to="/search" className={item} activeProps={active}>
            <Search className="h-6 w-6" strokeWidth={2.2} />
            <span>{t("tabs.search")}</span>
          </Link>
        </li>
        <li className="flex justify-center">
          <NavRecordButton />
        </li>
        <li>
          <Link to="/memories" className={item} activeProps={active}>
            <CalendarDays className="h-6 w-6" strokeWidth={2} />
            <span>{t("tabs.memories")}</span>
          </Link>
        </li>
        <li>
          <Link to="/profile" className={item} activeProps={active}>
            <UserAvatar name={name} path={me.data?.avatar_path} size={24} className="bg-muted-foreground/40" />
            <span>{t("tabs.profile")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
