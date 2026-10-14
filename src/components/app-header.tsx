import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell, ChevronLeft, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/wordmark";
import { useUnheardCount } from "@/hooks/use-threads";
import { useQuery } from "@tanstack/react-query";
import { notificationKeys, unreadCount } from "@/lib/notifications";

/**
 * Screen header (Glass): centered wordmark (or a title / custom center) with optional left and right slots over a
 * scroll edge (content softens as it passes under); `back` = a round glass chevron. `large` = an iOS large title on
 * the left (tab roots: Campus, Αναζήτηση…) with an optional small `kicker` line above it; it scrolls away with the page.
 */
export function AppHeader({
  title,
  center,
  left,
  right,
  back,
  large,
  kicker,
}: {
  title?: string;
  center?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  back?: boolean;
  large?: ReactNode;
  kicker?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  if (large)
    return (
      <header className="safe-top relative z-30">
        <div className="flex items-end justify-between gap-3 px-4 pb-1 pt-3">
          <div className="min-w-0">
            {kicker && <div className="line-clamp-2 text-caption font-medium text-muted-foreground">{kicker}</div>}
            <h1 className="truncate text-hero">{large}</h1>
          </div>
          <div className="-mb-1.5 -mr-2.5 flex shrink-0 items-center">{right}</div>
        </div>
      </header>
    );
  return (
    <header className="safe-top sticky top-0 z-30">
      <div aria-hidden className="scroll-edge pointer-events-none absolute inset-x-0 top-0 -bottom-6" />
      <div className="relative flex h-14 items-center justify-center px-4">
        <div className="absolute left-2 flex items-center">
          {back ? (
            <button
              type="button"
              onClick={() => router.history.back()}
              aria-label={t("common.back", "Back")}
              className="glass grid h-11 w-11 place-items-center rounded-full text-foreground"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.1} />
            </button>
          ) : (
            left
          )}
        </div>
        {center ??
          (title ? (
            <h1 className="max-w-[60%] truncate text-[17px] font-semibold tracking-[-0.01em]">{title}</h1>
          ) : (
            <Wordmark />
          ))}
        <div className="absolute right-3 flex items-center">{right}</div>
      </div>
    </header>
  );
}

/** Groups a few icon buttons (e.g. notifications + messages). */
export function HeaderPill({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function HeaderIconLink({
  to,
  label,
  children,
  badge,
}: {
  to: "/messages" | "/notifications" | "/talk";
  label: string;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <Link to={to} aria-label={label} className="glass relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground">
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border-2 border-background bg-live px-1 text-center text-[10px] font-semibold leading-[14px] text-destructive-foreground tabular-nums animate-scale-in">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Notifications (bell): top right of Home's large title. */
export function HomeBell() {
  const { t } = useTranslation();
  const unread = useQuery({ queryKey: notificationKeys.unread, queryFn: unreadCount });
  return (
    <HeaderIconLink to="/notifications" label={t("tabs.notifications")} badge={unread.data}>
      <Bell className="h-5 w-5" strokeWidth={1.8} />
    </HeaderIconLink>
  );
}

/** Messages (paper plane): beside Home's feed switch, so it stays in reach while scrolling. */
export function HomeMessages() {
  const { t } = useTranslation();
  const unheard = useUnheardCount();
  return (
    <HeaderIconLink to="/messages" label={t("tabs.messages")} badge={unheard}>
      <Send className="h-5 w-5" strokeWidth={1.8} />
    </HeaderIconLink>
  );
}
