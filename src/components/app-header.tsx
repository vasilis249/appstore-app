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
    <header className="safe-top sticky top-0 z-30 bg-background/90 backdrop-blur">
      <div className="relative flex h-16 items-center justify-center px-4">
        <div className="absolute left-4 flex items-center">
          {back ? (
            <button
              type="button"
              onClick={() => router.history.back()}
              aria-label={t("common.back", "Back")}
              className="grid h-10 w-10 place-items-center rounded-full bg-secondary"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            left
          )}
        </div>
        {center ??
          (title ? (
            <h1 className="text-lg font-bold">{title}</h1>
          ) : (
            <Wordmark />
          ))}
        <div className="absolute right-4 flex items-center">{right}</div>
      </div>
    </header>
  );
}

/** Rounded dark pill that groups a few icon buttons (e.g. messages + notifications). */
export function HeaderPill({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1 rounded-full bg-secondary px-1.5 py-1">{children}</div>;
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
    <Link to={to} aria-label={label} className="relative grid h-9 w-10 place-items-center rounded-full">
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-badge px-1.5 text-center text-[11px] font-bold leading-5 text-white">
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
