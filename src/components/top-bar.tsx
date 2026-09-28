import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Search, Moon, Sun, Plus, UserSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { NotificationsBell } from "@/components/notifications-bell";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { AccountMenu } from "@/components/account-menu";
import { MessagesButton } from "@/components/messages-button";

export function TopBar() {
  const { user, role, actualRole } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const r = role as string | null;
  const isAdmin = actualRole === "admin";
  const isPureOwner = r === "owner";
  const isOwnerOrAdmin = r === "owner" || isAdmin;

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border bg-background/95 text-foreground backdrop-blur">
      <div className="flex h-20 sm:h-24 xl:h-28 w-full items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* LEFT + MIDDLE: logo + nav + search (one stretchable row) */}
        <div className="flex flex-1 items-center gap-2 lg:gap-3">
          <Link
            to={isPureOwner ? "/owner" : "/"}
            className="flex shrink-0 items-center"
          >
            <Logo className="h-[44px] sm:h-[64px] md:h-[80px] xl:h-[104px] w-auto" />
          </Link>

          {/* Player / admin nav */}
          {!isPureOwner && (
            <nav className="hidden shrink-0 items-center gap-2 lg:gap-3 text-sm font-medium lg:flex">
              <Link
                to="/venues"
                activeProps={{ className: "text-foreground font-bold border-b-2 border-coral" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="-mb-[2px] border-b-2 border-transparent pb-1 transition-colors"
              >
                {t("nav.venues")}
              </Link>
              {user && (
                <Link
                  to="/bookings"
                  activeProps={{ className: "text-foreground font-bold border-b-2 border-coral" }}
                  inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                  className="-mb-[2px] border-b-2 border-transparent pb-1 transition-colors"
                >
                  {t("nav.bookings")}
                </Link>
              )}
              <Link
                to="/open-games"
                activeProps={{ className: "text-foreground font-bold border-b-2 border-coral" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="-mb-[2px] border-b-2 border-transparent pb-1 transition-colors"
              >
                {t("nav.games")}
              </Link>
              {user && (
                <Link
                  to="/community"
                  activeProps={{ className: "text-foreground font-bold border-b-2 border-coral" }}
                  inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                  className="-mb-[2px] border-b-2 border-transparent pb-1 transition-colors"
                >
                  {t("nav.community")}
                </Link>
              )}
              {!isOwnerOrAdmin && (
                <Link
                  to="/"
                  hash="owner-cta"
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  {t("home.ownerCta.navLink")}
                </Link>
              )}
              {isOwnerOrAdmin && (
                <Link
                  to="/owner"
                  activeProps={{ className: "font-bold border-b-2 border-coral" }}
                  inactiveProps={{ className: "hover:opacity-90" }}
                  className="-mb-[2px] border-b-2 border-transparent pb-1 text-primary transition-colors"
                >
                  {t("nav.owner")}
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  activeProps={{ className: "font-bold border-b-2 border-coral" }}
                  inactiveProps={{ className: "hover:opacity-90" }}
                  className="-mb-[2px] border-b-2 border-transparent pb-1 text-primary transition-colors"
                >
                  {t("nav.admin")}
                </Link>
              )}
            </nav>
          )}

          {/* Owner-only nav */}
          {isPureOwner && (
            <nav className="hidden shrink-0 items-center gap-2 lg:gap-3 text-sm font-medium lg:flex">
              {[
                { to: "/owner", label: t("nav.ownerPanel.dashboard"), exact: true },
                { to: "/owner/venues", label: t("nav.ownerPanel.myVenues") },
                { to: "/owner/bookings", label: t("nav.ownerPanel.bookings") },
                { to: "/owner/pricing", label: t("nav.ownerPanel.pricing") },
                { to: "/owner/hours", label: t("nav.ownerPanel.hours") },
              ].map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  activeOptions={{ exact: i.exact }}
                  activeProps={{ className: "text-foreground font-bold border-b-2 border-coral" }}
                  inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                  className="-mb-[2px] border-b-2 border-transparent pb-1 transition-colors"
                >
                  {i.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Search / spacer */}
          {!isPureOwner ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/venues", search: { q: q.trim() || undefined } });
              }}
              className="hidden h-11 flex-1 items-center gap-2 rounded-2xl border border-border bg-background px-3 text-foreground shadow-sm md:flex"
            >
              <MapPin className="h-4 w-4 text-primary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                name="q"
                placeholder={t("nav.searchPlaceholder")}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" aria-label={t("nav.search")} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <Search className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="hidden flex-1 md:block" />
          )}

          {/* Mobile search icon */}
          {!isPureOwner && (
            <Link
              to="/venues"
              aria-label={t("nav.search")}
              className="ml-auto hidden h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground sm:inline-flex md:hidden"
            >
              <Search className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* RIGHT: controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Phones, signed in: people search + inbox + notifications; language lives in Settings. */}
          {user && !isPureOwner && (
            <>
              <Link
                to="/community"
                aria-label={t("bottomNav.community")}
                className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition hover:bg-muted md:hidden"
              >
                <UserSearch className="h-5 w-5" />
              </Link>
              <MessagesButton className="md:hidden" />
            </>
          )}
          <span className={user && !isPureOwner ? "hidden sm:inline-flex" : "inline-flex"}>
            <LanguageToggle />
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? t("nav.lightMode") : t("nav.nightMode")}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-muted sm:inline-flex"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user && <NotificationsBell />}

          {isPureOwner ? (
            <Link
              to="/owner/venues"
              className="hidden rounded-xl bg-coral px-4 py-2 text-sm font-bold text-white shadow-glow transition hover:opacity-95 sm:inline-flex sm:items-center sm:gap-1.5"
            >
              <Plus className="h-4 w-4" /> {t("nav.ownerPanel.addVenue")}
            </Link>
          ) : (
            <Link
              to="/venues"
              className="hidden rounded-xl bg-coral px-4 py-2 text-sm font-bold text-white shadow-glow transition hover:opacity-95 sm:inline-flex"
            >
              {t("nav.bookCourt")}
            </Link>
          )}

          <span className={user && !isPureOwner ? "hidden sm:inline-flex" : "inline-flex"}>
            <AccountMenu />
          </span>
        </div>
      </div>
    </header>
  );
}
