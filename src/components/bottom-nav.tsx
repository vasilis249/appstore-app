import { Link } from "@tanstack/react-router";
import { CalendarDays, Headphones, MessageCircle, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

/** Four icon-only tabs, on every screen size (the app is phone-first). */
export function BottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  if (!user) return null;

  const tabs = [
    { to: "/", label: t("tabs.feed"), icon: Headphones, exact: true },
    { to: "/messages", label: t("tabs.messages"), icon: MessageCircle },
    { to: "/calendar", label: t("tabs.calendar"), icon: CalendarDays },
    { to: "/profile", label: t("tabs.profile"), icon: User },
  ] as const;

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2">
        {tabs.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to}>
            <Link
              to={to}
              aria-label={label}
              className="flex h-14 items-center justify-center text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: "exact" in rest }}
            >
              <Icon className="h-6 w-6" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
