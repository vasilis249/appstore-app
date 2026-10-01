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

const TABS = ["/", "/map", "voice", "/search", "/profile"] as const;

/**
 * Tab bar (DESIGN.md, Quiet): a flat frosted bar with a hairline on top, five icons without labels — Home, Map, the
 * voice key (tap = compose, hold = push to talk from any screen), Search, Profile. The active icon is ink and
 * heavier, a small dot glides under it; a light haptic on every tab.
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
  const active = TABS.findIndex((to) => to !== "voice" && (to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`)));
  const item = (i: number) => cn("grid h-12 w-full place-items-center", i === active ? "text-foreground" : "text-muted-foreground");
  const stroke = (i: number) => (i === active ? 2.2 : 1.7);
  const tap = () => haptic("light");

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom,0px)]"
      style={{ viewTransitionName: "tabbar" }}
    >
      <div className="relative mx-auto grid h-[3.25rem] max-w-md grid-cols-5 items-center px-2">
        {/* the gliding dot under the active tab */}
        <span
          aria-hidden
          className={cn("nav-pill pointer-events-none absolute bottom-1 left-2 flex justify-center", active < 0 && "opacity-0")}
          style={{ width: "calc((100% - 1rem) / 5)", transform: `translateX(${Math.max(active, 0) * 100}%)` }}
        >
          <span className="h-1 w-1 rounded-full bg-foreground" />
        </span>
        <Link to="/" aria-label={t("tabs.feed")} className={item(0)} onClick={tap}>
          <HomeIcon filled={active === 0} />
        </Link>
        <Link to="/map" aria-label={t("tabs.map")} className={item(1)} onClick={tap}>
          <MapPin className="h-6 w-6" strokeWidth={stroke(1)} />
        </Link>
        <NavRecordButton />
        <Link to="/search" aria-label={t("tabs.search")} className={item(3)} onClick={tap}>
          <Search className="h-6 w-6" strokeWidth={stroke(3)} />
        </Link>
        <Link to="/profile" aria-label={t("tabs.profile")} className={item(4)} onClick={tap}>
          <span className={cn("rounded-full p-[2px] ring-[1.5px]", active === 4 ? "ring-foreground" : "ring-transparent")}>
            <UserAvatar name={name} path={me.data?.avatar_path} size={24} className="bg-secondary text-fine text-foreground" />
          </span>
        </Link>
      </div>
    </nav>
  );
}

/** The house: outline, heavier stroke when active (Quiet keeps icons as lines). */
function HomeIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={filled ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
