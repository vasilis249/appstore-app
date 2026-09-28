import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home, MapPin, CalendarCheck, User, LayoutDashboard, Tag, Clock, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { CreateSheet } from "@/components/create-sheet";

export function BottomNav() {
  const { user, role, actualRole } = useAuth();
  const { t } = useTranslation();
  const r = role as string | null;
  const isAdmin = actualRole === "admin";
  const isPureOwner = r === "owner";
  const isOwnerOrAdmin = r === "owner" || isAdmin;
  const [createOpen, setCreateOpen] = useState(false);

  // Owners keep a labelled nav (their sections have no obvious icons).
  if (isPureOwner) {
    const ownerItems = [
      { to: "/owner", label: t("nav.ownerPanel.dashboard"), icon: LayoutDashboard, exact: true },
      { to: "/owner/venues", label: t("nav.ownerPanel.myVenues"), icon: MapPin },
      { to: "/owner/bookings", label: t("nav.ownerPanel.bookings"), icon: CalendarCheck },
      { to: "/owner/pricing", label: t("nav.ownerPanel.pricing"), icon: Tag },
      { to: "/owner/hours", label: t("nav.ownerPanel.hours"), icon: Clock },
    ];
    return (
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {ownerItems.map(({ to, label, icon: Icon, exact }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground transition-colors"
                activeProps={{ className: "text-primary" }}
                activeOptions={{ exact: !!exact }}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // Players: five icon-only tabs, "+" in the middle (Instagram-style).
  const tab = "flex h-14 items-center justify-center text-muted-foreground transition-colors";
  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2">
        <li>
          <Link
            to="/"
            aria-label={t("bottomNav.home")}
            className={tab}
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <Home className="h-6 w-6" />
          </Link>
        </li>
        <li>
          <Link
            to="/venues"
            aria-label={t("bottomNav.venues")}
            className={tab}
            activeProps={{ className: "text-primary" }}
          >
            <MapPin className="h-6 w-6" />
          </Link>
        </li>
        <li>
          <button
            type="button"
            aria-label={t("create.title")}
            onClick={() => setCreateOpen(true)}
            className={`${tab} w-full`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Plus className="h-6 w-6" />
            </span>
          </button>
        </li>
        <li>
          {isOwnerOrAdmin ? (
            <Link
              to="/owner"
              aria-label={t("bottomNav.owner")}
              className={tab}
              activeProps={{ className: "text-primary" }}
            >
              <LayoutDashboard className="h-6 w-6" />
            </Link>
          ) : (
            <Link
              to="/bookings"
              aria-label={t("bottomNav.bookings")}
              className={tab}
              activeProps={{ className: "text-primary" }}
            >
              <CalendarCheck className="h-6 w-6" />
            </Link>
          )}
        </li>
        <li>
          <Link
            to={user ? "/profile" : "/auth"}
            aria-label={user ? t("bottomNav.profile") : t("bottomNav.signIn")}
            className={tab}
            activeProps={{ className: "text-primary" }}
          >
            <User className="h-6 w-6" />
          </Link>
        </li>
      </ul>
      <CreateSheet open={createOpen} onOpenChange={setCreateOpen} />
    </nav>
  );
}
