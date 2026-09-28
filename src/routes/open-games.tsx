import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayTabs } from "@/components/play-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, MapPin, ArrowRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listAvailableTodayVenues } from "@/lib/api/venues.functions";
import { SPORTS, type Sport } from "@/lib/sports";
import { cn } from "@/lib/utils";

import padelImg from "@/assets/sport-padel.jpg";
import tennisImg from "@/assets/sport-tennis.jpg";
import basketballImg from "@/assets/sport-basketball.jpg";
import footballImg from "@/assets/sport-football.jpg";
import volleyballImg from "@/assets/sport-volleyball.jpg";
import beachVolleyImg from "@/assets/sport-beach-volley.jpg";

const FALLBACK: Record<Sport, string> = {
  padel: padelImg,
  tennis: tennisImg,
  basketball: basketballImg,
  football: footballImg,
  volleyball: volleyballImg,
  beach_volley: beachVolleyImg,
};

const SLOT_ENABLED: Record<Sport, boolean> = {
  padel: true, tennis: true, basketball: false, football: false, volleyball: false, beach_volley: false,
};

export const Route = createFileRoute("/open-games")({
  head: () => ({
    meta: [
      { title: "Ανοιχτά γήπεδα — Courtsie" },
      { name: "description", content: "Όλα τα διαθέσιμα γήπεδα με ελεύθερες ώρες." },
    ],
  }),
  component: OpenVenuesPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextDays(n: number, locale: string) {
  const out: { iso: string; weekday: string; label: string; sub: string | null }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const weekdayShort = d.toLocaleDateString(locale, { weekday: "short" });
    const weekday =
      i === 0
        ? locale.startsWith("el") ? "Σήμερα" : "Today"
        : i === 1
          ? locale.startsWith("el") ? "Αύριο" : "Tomorrow"
          : weekdayShort;
    const label = d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
    const sub = i <= 1 ? weekdayShort : null;
    out.push({ iso, weekday, label, sub });
  }
  return out;
}

function OpenVenuesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [sport, setSport] = useState<Sport | "all">("all");
  const days = useMemo(() => nextDays(7, i18n.language || "el"), [i18n.language]);
  const [date, setDate] = useState<string>(() => todayISO());
  const isToday = date === todayISO();

  const q = useQuery({
    queryKey: ["available-by-date", date],
    queryFn: () => listAvailableTodayVenues({ data: { date } }),
    refetchInterval: 60_000,
  });

  // Realtime: any booking/closure/venue change refreshes the list
  useEffect(() => {
    const ch = supabase
      .channel(`available-by-date-${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () =>
        qc.invalidateQueries({ queryKey: ["available-by-date"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "court_closures" }, () =>
        qc.invalidateQueries({ queryKey: ["available-by-date"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "venues" }, () =>
        qc.invalidateQueries({ queryKey: ["available-by-date"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, date]);

  const filtered = useMemo(() => {
    const all = q.data ?? [];
    return sport === "all" ? all : all.filter((v) => v.sport === sport);
  }, [q.data, sport]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-24">
      <header className="mb-6">
        <h1 className="sr-only">{t("openVenues.title", "Ανοιχτά γήπεδα")}</h1>
        <PlayTabs />
        <p className="text-sm text-muted-foreground">
          {isToday
            ? t("openVenues.subtitleToday", "Διαθέσιμες ώρες για σήμερα — μόνο ώρες μετά το τώρα.")
            : t("openVenues.subtitleOther", "Διαθέσιμες ώρες προς κράτηση.")}
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => setDate(d.iso)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              date === d.iso
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span className="font-semibold">{d.weekday}</span>
            <span className="ml-1 opacity-80">{d.label}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSport("all")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium",
            sport === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
          )}
        >
          {t("sports.all")}
        </button>
        {SPORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSport(s.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              sport === s.id ? s.tokenClass : "border-border bg-card hover:border-primary/40",
            )}
          >
            {t(`sports.${s.id}`)}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading", "Φόρτωση…")}</p>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {isToday
              ? t("openVenues.emptyToday", "Δεν υπάρχουν διαθέσιμα παιχνίδια σήμερα.")
              : t("openVenues.emptyOther", "Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <VenueCard key={v.id} venue={v} date={date} />
          ))}
        </div>
      )}
    </div>
  );
}

function VenueCard({
  venue,
  date,
}: {
  venue: Awaited<ReturnType<typeof listAvailableTodayVenues>>[number];
  date: string;
}) {
  const { t } = useTranslation();
  const sportMeta = SPORTS.find((s) => s.id === venue.sport)!;
  const img = venue.photo_url || FALLBACK[venue.sport];
  const visible = venue.slots.slice(0, 6);
  const more = venue.slots.length - visible.length;
  const slotMode = SLOT_ENABLED[venue.sport];
  const perPerson = slotMode
    ? Number((venue as any).slot_price ?? 0)
    : Number(venue.base_price_per_hour);
  const noPrice = !perPerson || perPerson <= 0;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:-translate-y-0.5 hover:border-primary/40">
      <Link to="/venues/$venueId" params={{ venueId: venue.id }} className="relative aspect-[16/10] overflow-hidden">
        <img src={img} alt={venue.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur ${sportMeta.tokenClass}`}>
          {t(`sports.${venue.sport}`)}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to="/venues/$venueId" params={{ venueId: venue.id }}>
          <h3 className="font-display text-lg font-semibold leading-tight hover:underline">{venue.name}</h3>
        </Link>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {venue.area}
        </p>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" /> {t("openVenues.freeSlots", "Διαθέσιμες ώρες")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visible.map((s) =>
              noPrice ? (
                <span
                  key={s}
                  title={t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
                  className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {s}
                </span>
              ) : (
                <Link
                  key={s}
                  to="/book/$venueId"
                  params={{ venueId: venue.id }}
                  className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {s}
                </Link>
              ),
            )}
            {more > 0 && (
              <span
                title={t("openVenues.moreSlots", { count: more })}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                +{more}
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          {noPrice ? (
            <span className="text-xs font-medium text-muted-foreground">
              {t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
            </span>
          ) : (
            <span className="font-display text-lg font-bold">
              €{perPerson.toFixed(perPerson < 10 ? 1 : 0)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {slotMode ? t("common.perPerson", "/ άτομο") : t("common.perHour")}
              </span>
            </span>
          )}
          {noPrice ? (
            <button
              type="button"
              disabled
              title={t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground opacity-60"
            >
              {t("openVenues.book", "Κράτηση")}
            </button>
          ) : (
            <Link
              to="/book/$venueId"
              params={{ venueId: venue.id }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              {t("openVenues.book", "Κράτηση")} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
