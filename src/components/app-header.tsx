import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell, ChevronLeft, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/wordmark";
import { useUnheardCount } from "@/hooks/use-threads";
import { useQuery } from "@tanstack/react-query";
import { notificationKeys, unreadCount } from "@/lib/notifications";

/**
 * Screen header: centered wordmark (or a title / custom center) with optional
 * left and right slots. `back` shows a chevron that goes back in history.
 */
export function AppHeader({
  title,
  center,
  left,
  right,
  back,
}: {
  title?: string;
  center?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  back?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <header className="glass safe-top sticky top-0 z-30 border-b border-border/60">
      <div className="relative flex h-14 items-center justify-center px-4">
        <div className="absolute left-2 flex items-center">
          {back ? (
            <button
              type="button"
              onClick={() => router.history.back()}
              aria-label={t("common.back", "Back")}
              className="grid h-11 w-11 place-items-center rounded-full text-link"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.2} />
            </button>
          ) : (
            left
          )}
        </div>
        {center ??
          (title ? (
            <h1 className="max-w-[60%] truncate text-body font-semibold">{title}</h1>
          ) : (
            <Wordmark />
          ))}
        <div className="absolute right-3 flex items-center">{right}</div>
      </div>
    </header>
  );
}

/** Groups a few icon buttons (e.g. messages + notifications): plain 44 px icons in the ink colour. */
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
        <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-live px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Messages + notifications, top right of the Home screen. */
export function HomeHeaderActions() {
  const { t } = useTranslation();
  const unheard = useUnheardCount();
  const unread = useQuery({ queryKey: notificationKeys.unread, queryFn: unreadCount });
  return (
    <HeaderPill>
      <HeaderIconLink to="/messages" label={t("tabs.messages")} badge={unheard}>
        <Send className="h-5 w-5" />
      </HeaderIconLink>
      <HeaderIconLink to="/notifications" label={t("tabs.notifications")} badge={unread.data}>
        <Bell className="h-5 w-5" />
      </HeaderIconLink>
    </HeaderPill>
  );
}
