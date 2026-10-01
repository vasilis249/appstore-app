import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell, ChevronLeft, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/wordmark";
import { useUnheardCount } from "@/hooks/use-threads";
import { useQuery } from "@tanstack/react-query";
import { notificationKeys, unreadCount } from "@/lib/notifications";

/**
 * Screen header: centered wordmark (or a title / custom center) with optional left and right slots. `back` shows a
 * chevron that goes back in history. `large` = an iOS large title on the left (tab roots: Campus, Ειδήσεις…) with an
 * optional small `kicker` line above it.
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
      <header className="safe-top sticky top-0 z-30 bg-background/90 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-3 px-4 pb-1 pt-3">
          <div className="min-w-0">
            {kicker && <div className="truncate text-caption font-medium text-muted-foreground">{kicker}</div>}
            <h1 className="truncate text-hero">{large}</h1>
          </div>
          <div className="-mb-1.5 -mr-2.5 flex shrink-0 items-center">{right}</div>
        </div>
      </header>
    );
  return (
    <header className="safe-top sticky top-0 z-30 bg-background/90 backdrop-blur-xl">
      <div className="relative flex h-14 items-center justify-center px-4">
        <div className="absolute left-2 flex items-center">
          {back ? (
            <button
              type="button"
              onClick={() => router.history.back()}
              aria-label={t("common.back", "Back")}
              className="grid h-11 w-11 place-items-center rounded-full text-foreground"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={1.9} />
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

/** Groups a few icon buttons (e.g. notifications + messages): plain 44 px icons in the ink colour. */
export function HeaderPill({ children }: { children: ReactNode }) {
  return <div className="flex items-center">{children}</div>;
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
    <Link to={to} aria-label={label} className="relative grid h-11 w-11 place-items-center rounded-full text-foreground">
      {children}
      {badge ? (
        <span className="absolute right-0.5 top-1 min-w-[18px] rounded-full border-2 border-background bg-live px-1 text-center text-[10px] font-semibold leading-[14px] text-destructive-foreground tabular-nums animate-scale-in">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Notifications (bell) + messages (paper plane), top right of the Home screen. */
export function HomeHeaderActions() {
  const { t } = useTranslation();
  const unheard = useUnheardCount();
  const unread = useQuery({ queryKey: notificationKeys.unread, queryFn: unreadCount });
  return (
    <HeaderPill>
      <HeaderIconLink to="/notifications" label={t("tabs.notifications")} badge={unread.data}>
        <Bell className="h-[23px] w-[23px]" strokeWidth={1.7} />
      </HeaderIconLink>
      <HeaderIconLink to="/messages" label={t("tabs.messages")} badge={unheard}>
        <Send className="h-[22px] w-[22px]" strokeWidth={1.7} />
      </HeaderIconLink>
    </HeaderPill>
  );
}
