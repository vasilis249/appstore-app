import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Heart, Send } from "lucide-react";
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
              <ChevronLeft className="h-7 w-7" strokeWidth={2.2} />
            </button>
          ) : (
            left
          )}
        </div>
        {center ??
          (title ? (
            <h1 className="max-w-[60%] truncate text-[17px] font-bold">{title}</h1>
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
        <span className="absolute right-0 top-0 min-w-5 rounded-full border-2 border-background bg-live px-1 text-center text-[11px] font-bold leading-4 text-destructive-foreground animate-scale-in">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Notifications (heart) + messages (paper plane), top right of the Home screen. */
export function HomeHeaderActions() {
  const { t } = useTranslation();
  const unheard = useUnheardCount();
  const unread = useQuery({ queryKey: notificationKeys.unread, queryFn: unreadCount });
  return (
    <HeaderPill>
      <HeaderIconLink to="/notifications" label={t("tabs.notifications")} badge={unread.data}>
        <Heart className="h-[26px] w-[26px]" strokeWidth={1.9} />
      </HeaderIconLink>
      <HeaderIconLink to="/messages" label={t("tabs.messages")} badge={unheard}>
        <Send className="h-[25px] w-[25px]" strokeWidth={1.9} />
      </HeaderIconLink>
    </HeaderPill>
  );
}
