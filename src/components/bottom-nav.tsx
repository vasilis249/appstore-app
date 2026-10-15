import { Link, useRouterState } from "@tanstack/react-router";
import { MapPin, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-my-profile";
import { UserAvatar } from "@/components/user-avatar";
import { NavRecordButton } from "@/components/voice/nav-record-button";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Sign-in / sign-up / password pages (also shown right after sign-up, while already signed in). */
export const AUTH_PATHS = /^\/(auth|forgot-password|reset-password|i)(\/|$)/;

const TABS = ["/", "/map", "/search", "/profile"] as const;

/**
 * Tab bar (DESIGN.md, Glass): a floating glass capsule with four labelled icons — Home, Map, Search, Profile; a soft pill glides
 * to the active one — and beside it the voice drop (tap = compose, hold = push to talk from any screen). A light
 * haptic on every tab.
 */
export function BottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const me = useMyProfile();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // A conversation has its own composer at the bottom; sign-in steps have their own button.
  // The composer is a focused screen (its own push-to-talk button and Publish at the bottom).
  if (!user || /^\/(messages|talk)\/./.test(path) || AUTH_PATHS.test(path) || path === "/record" || path === "/student") return null;

  const name = me.data?.full_name || me.data?.username || (user.user_metadata?.full_name as string | undefined) || "?";
  const active = TABS.findIndex((to) => (to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`)));
  // iOS-style label under each icon (AUDIT #9): the bar keeps its 62px height.
  const item = (i: number) => cn("relative z-10 flex h-[50px] w-full flex-col items-center justify-center gap-0.5", i === active ? "text-foreground" : "text-muted-foreground");
  const label = (key: string) => <span className="text-[10px] font-medium leading-3">{t(key)}</span>;
  const stroke = (i: number) => (i === active ? 2.2 : 1.8);
  const tap = () => haptic("light");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]"
      style={{ viewTransitionName: "tabbar" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-2.5">
        <div className="glass relative grid h-[62px] flex-1 grid-cols-4 items-center rounded-full px-1.5">
          {/* the pill gliding to the active tab */}
          <span
            aria-hidden
            className={cn("nav-pill pointer-events-none absolute inset-y-[6px] left-1.5 flex justify-center", active < 0 && "opacity-0")}
            style={{ width: "calc((100% - 0.75rem) / 4)", transform: `translateX(${Math.max(active, 0) * 100}%)` }}
          >
            <span className="h-full w-16 rounded-full bg-[var(--nav-active)]" />
          </span>
          <Link to="/" aria-current={active === 0 ? "page" : undefined} className={item(0)} onClick={tap}>
            <HomeIcon filled={active === 0} />
            {label("tabs.feed")}
          </Link>
          <Link to="/map" aria-current={active === 1 ? "page" : undefined} className={item(1)} onClick={tap}>
            <MapPin className="h-6 w-6" strokeWidth={stroke(1)} />
            {label("tabs.map")}
          </Link>
          <Link to="/search" aria-current={active === 2 ? "page" : undefined} className={item(2)} onClick={tap}>
            <Search className="h-6 w-6" strokeWidth={stroke(2)} />
            {label("tabs.search")}
          </Link>
          <Link to="/profile" aria-current={active === 3 ? "page" : undefined} className={item(3)} onClick={tap}>
            <span className={cn("rounded-full p-[2px] ring-[1.5px]", active === 3 ? "ring-foreground" : "ring-transparent")}>
              <UserAvatar name={name} path={me.data?.avatar_path} size={20} className="bg-primary text-fine text-primary-foreground" />
            </span>
            {label("tabs.profile")}
          </Link>
        </div>
        <NavRecordButton />
      </div>
    </nav>
  );
}

/** The house: filled when active, a line otherwise. */
function HomeIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M3.5 10.3 12 3.5l8.5 6.8V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 10.3 12 3.5l8.5 6.8V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </svg>
  );
}
