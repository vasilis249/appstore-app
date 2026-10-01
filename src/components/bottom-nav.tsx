import { Link, useRouterState } from "@tanstack/react-router";
import { MapPin, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-my-profile";
import { UserAvatar } from "@/components/user-avatar";
import { NavRecordButton } from "@/components/voice/nav-record-button";
import { cn } from "@/lib/utils";

/** Sign-in / sign-up / password pages (also shown right after sign-up, while already signed in). */
export const AUTH_PATHS = /^\/(auth|forgot-password|reset-password|i)(\/|$)/;

const TABS = ["/", "/map", "voice", "/search", "/profile"] as const;

/**
 * Floating tab capsule (DESIGN.md, social): five icons without labels — Home, Map, the voice mark (tap = compose,
 * hold = push to talk from any screen), Search, Profile. The active tab sits on a grey pill that glides between
 * tabs; the active icon is filled / heavier.
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
  const item = "relative z-10 grid h-12 w-full place-items-center rounded-full text-foreground";
  const stroke = (i: number) => (i === active ? 2.6 : 1.9);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]"
      style={{ viewTransitionName: "tabbar" }}
    >
      <div className="relative mx-auto grid max-w-md grid-cols-5 items-center rounded-full bg-nav p-1.5 shadow-float backdrop-blur-xl backdrop-saturate-150">
        {/* the gliding pill (one fifth of the capsule) */}
        <span
          aria-hidden
          className={cn("nav-pill pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full bg-nav-active", active < 0 && "opacity-0")}
          style={{ width: "calc((100% - 0.75rem) / 5)", transform: `translateX(${Math.max(active, 0) * 100}%)` }}
        />
        <Link to="/" aria-label={t("tabs.feed")} className={item}>
          <HomeIcon filled={active === 0} />
        </Link>
        <Link to="/map" aria-label={t("tabs.map")} className={item}>
          <MapPin className="h-[26px] w-[26px]" strokeWidth={stroke(1)} />
        </Link>
        <NavRecordButton />
        <Link to="/search" aria-label={t("tabs.search")} className={item}>
          <Search className="h-[26px] w-[26px]" strokeWidth={stroke(3)} />
        </Link>
        <Link to="/profile" aria-label={t("tabs.profile")} className={item}>
          <span className={cn("rounded-full p-[2px]", active === 4 ? "ring-2 ring-foreground" : "")}>
            <UserAvatar name={name} path={me.data?.avatar_path} size={26} className="bg-secondary text-fine text-foreground" />
          </span>
        </Link>
      </div>
    </nav>
  );
}

/** House like Instagram's: outline, or filled with the door cut out when active. */
function HomeIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10.6 2.6a2 2 0 0 1 2.8 0l7.4 7.1a2 2 0 0 1 .6 1.5V20a2 2 0 0 1-2 2h-4.2v-5.5a2 2 0 0 0-2-2h-2.4a2 2 0 0 0-2 2V22H4.6a2 2 0 0 1-2-2v-8.8a2 2 0 0 1 .6-1.5z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden>
      <path d="M3.5 10.4 11.3 3a1 1 0 0 1 1.4 0l7.8 7.4v9.6a1 1 0 0 1-1 1h-4.6v-5.6a1.9 1.9 0 0 0-1.9-1.9h-2a1.9 1.9 0 0 0-1.9 1.9V21H4.5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
