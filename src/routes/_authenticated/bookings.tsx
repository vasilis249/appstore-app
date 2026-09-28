import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  queryOptions,
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  MapPin,
  Repeat,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useRedirectOwnersAway } from "@/hooks/use-redirect-owners-away";
import {
  listMyBookings,
  listMyJoinedGames,
  cancelMyBooking,
  cancelMySeries,
  type MyBookingRow,
  type MyJoinedGameRow,
} from "@/lib/api/player-bookings.functions";
import { leaveOpenGame } from "@/lib/api/venues.functions";
import { SPORTS } from "@/lib/sports";

const myBookingsQuery = () =>
  queryOptions({
    queryKey: ["my-bookings"],
    queryFn: () => listMyBookings(),
  });

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Οι κρατήσεις μου — Courtsie" },
      { name: "description", content: "Διαχειρίσου τις κρατήσεις σου ανά εβδομάδα." },
    ],
  }),
  component: BookingsPage,
});

/* ---------- date utils ---------- */
import {
  startOfDay,
  endOfDay,
  startOfWeek as dfStartOfWeek,
  endOfWeek as dfEndOfWeek,
  startOfMonth,
  endOfMonth,
  addDays as dfAddDays,
  addWeeks,
  addMonths,
  isSameDay,
  isSameWeek,
  isSameMonth,
  format as dfFormat,
} from "date-fns";

function addDays(d: Date, n: number) {
  return dfAddDays(d, n);
}
function isoDate(d: Date) {
  return dfFormat(d, "yyyy-MM-dd");
}
function fmtRange(start: Date, end: Date, locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

type ViewMode = "day" | "week" | "month";

function getPeriodBounds(mode: ViewMode, anchor: Date): { start: Date; end: Date } {
  if (mode === "day") return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (mode === "month") return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  return {
    start: dfStartOfWeek(anchor, { weekStartsOn: 1 }),
    end: dfEndOfWeek(anchor, { weekStartsOn: 1 }),
  };
}

type UnifiedItem =
  | { kind: "booking"; date: string; start_time: string; booking: MyBookingRow }
  | { kind: "joined"; date: string; start_time: string; game: MyJoinedGameRow };

function BookingsPage() {
  useRedirectOwnersAway();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyBookings);
  const listJoinedFn = useServerFn(listMyJoinedGames);
  const leaveFn = useServerFn(leaveOpenGame);
  const cancelFn = useServerFn(cancelMyBooking);
  const cancelSeriesFn = useServerFn(cancelMySeries);

  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [tab, setTab] = useState<"active" | "cancelled">("active");
  const [courtFilter, setCourtFilter] = useState<string>("all");

  const locale = i18n.language === "el" ? "el-GR" : i18n.language;

  const { data: bookings, isLoading } = useQuery({
    ...myBookingsQuery(),
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const { data: joinedGames } = useQuery({
    queryKey: ["my-joined-games"],
    queryFn: () => listJoinedFn(),
    enabled: !!user,
  });


  // realtime updates for the current user's bookings
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-bookings:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `player_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-bookings"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPeriodBounds(viewMode, anchor),
    [viewMode, anchor],
  );
  const startIso = isoDate(periodStart);
  const endIso = isoDate(periodEnd);

  const cancelledRecent = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (bookings ?? [])
      .filter(
        (b) =>
          b.status === "cancelled" &&
          b.cancelled_at &&
          new Date(b.cancelled_at).getTime() >= cutoff,
      )
      .sort((a, b) =>
        (b.cancelled_at ?? "").localeCompare(a.cancelled_at ?? ""),
      );
  }, [bookings]);

  const courtOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    for (const b of bookings ?? []) {
      if (b.status === "cancelled") continue;
      if (!b.court_name) continue;
      const key = `${b.venue_id}::${b.court_name}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: `${b.venue?.name ?? "—"} · ${b.court_name}`,
        });
      }
    }
    for (const g of joinedGames ?? []) {
      if (!g.court_name) continue;
      const key = `${g.venue_id}::${g.court_name}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: `${g.venue?.name ?? "—"} · ${g.court_name}`,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [bookings, joinedGames]);

  // UnifiedItem type lives at module scope (see below)


  const periodItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];
    for (const b of bookings ?? []) {
      if (b.status === "cancelled") continue;
      if (b.date < startIso || b.date > endIso) continue;
      if (courtFilter !== "all" && `${b.venue_id}::${b.court_name}` !== courtFilter) continue;
      items.push({ kind: "booking", date: b.date, start_time: b.start_time, booking: b });
    }
    for (const g of joinedGames ?? []) {
      if (g.date < startIso || g.date > endIso) continue;
      if (courtFilter !== "all" && `${g.venue_id}::${g.court_name}` !== courtFilter) continue;
      items.push({ kind: "joined", date: g.date, start_time: g.start_time, game: g });
    }
    items.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    return items;
  }, [bookings, joinedGames, startIso, endIso, courtFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, UnifiedItem[]>();
    for (const it of periodItems) {
      const arr = m.get(it.date) ?? [];
      arr.push(it);
      m.set(it.date, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [periodItems]);

  const cancelOne = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Η κράτηση ακυρώθηκε");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSeries = useMutation({
    mutationFn: (seriesId: string) => cancelSeriesFn({ data: { seriesId } }),
    onSuccess: (r: any) => {
      toast.success("Η σειρά κρατήσεων ακυρώθηκε");
      void r;
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveGame = useMutation({
    mutationFn: (openGameId: string) => leaveFn({ data: { openGameId } }),
    onSuccess: () => {
      toast.success("Αποχώρησες από το παιχνίδι");
      qc.invalidateQueries({ queryKey: ["my-joined-games"] });
      qc.invalidateQueries({ queryKey: ["open-games"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCurrentPeriod =
    viewMode === "day"
      ? isSameDay(anchor, today)
      : viewMode === "week"
        ? isSameWeek(anchor, today, { weekStartsOn: 1 })
        : isSameMonth(anchor, today);

  const periodLabel =
    viewMode === "day"
      ? new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(periodStart)
      : viewMode === "month"
        ? new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
          }).format(periodStart)
        : fmtRange(periodStart, periodEnd, locale);

  const eyebrowKey = isCurrentPeriod
    ? viewMode === "day"
      ? "bookings.period.currentDay"
      : viewMode === "week"
        ? "bookings.period.currentWeek"
        : "bookings.period.currentMonth"
    : `bookings.period.${viewMode}`;

  const stepPrev = () => {
    if (viewMode === "day") setAnchor((a) => addDays(a, -1));
    else if (viewMode === "week") setAnchor((a) => addWeeks(a, -1));
    else setAnchor((a) => addMonths(a, -1));
  };
  const stepNext = () => {
    if (viewMode === "day") setAnchor((a) => addDays(a, 1));
    else if (viewMode === "week") setAnchor((a) => addWeeks(a, 1));
    else setAnchor((a) => addMonths(a, 1));
  };
  const changeMode = (m: ViewMode) => {
    setViewMode(m);
    setAnchor(new Date());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Οι κρατήσεις μου</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("bookings.subtitle")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 inline-flex rounded-xl border border-border/60 bg-card p-1">
        <button
          onClick={() => setTab("active")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ενεργές
        </button>
        <button
          onClick={() => setTab("cancelled")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === "cancelled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ακυρωμένες {cancelledRecent.length > 0 && `(${cancelledRecent.length})`}
        </button>
      </div>

      {tab === "active" ? (
        <>
          {/* View-mode switcher */}
          <div className="mt-4 inline-flex rounded-xl border border-border/60 bg-card p-1">
            {(["day", "week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`bookings.viewMode.${m}`)}
              </button>
            ))}
          </div>

          {courtOptions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2">
              <label htmlFor="court-filter" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("bookings.filterCourt")}
              </label>
              <select
                id="court-filter"
                value={courtFilter}
                onChange={(e) => setCourtFilter(e.target.value)}
                className="flex-1 min-w-[200px] rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">{t("bookings.allCourts")}</option>
                {courtOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-card px-3 py-2">
            <button
              onClick={stepPrev}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 hover:border-primary/40"
              aria-label="Προηγούμενη περίοδος"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(eyebrowKey)}
              </div>
              <div className="font-display text-lg font-semibold capitalize">{periodLabel}</div>
            </div>
            <div className="flex items-center gap-2">
              {!isCurrentPeriod && (
                <button
                  onClick={() => setAnchor(new Date())}
                  className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                >
                  Σήμερα
                </button>
              )}
              <button
                onClick={stepNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 hover:border-primary/40"
                aria-label="Επόμενη περίοδος"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση…
            </div>
          ) : periodItems.length === 0 ? (
            <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <CalendarCheck className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 font-display text-lg font-semibold">{t(`bookings.empty.${viewMode}`)}</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {t("bookings.emptyHint")}
              </p>
              <Link
                to="/venues"
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Δες γήπεδα
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {grouped.map(([date, items]) => (
                <DayGroup
                  key={date}
                  date={date}
                  items={items}
                  today={isoDate(today)}
                  onCancel={(id) => {
                    if (confirm("Ακύρωση κράτησης;")) cancelOne.mutate(id);
                  }}
                  onCancelSeries={(seriesId) => {
                    if (confirm("Ακύρωση όλης της επαναλαμβανόμενης σειράς (μόνο μελλοντικές);"))
                      cancelSeries.mutate(seriesId);
                  }}
                  onLeave={(openGameId) => {
                    if (confirm(t("bookings.confirmLeave"))) leaveGame.mutate(openGameId);
                  }}
                  cancellingId={cancelOne.isPending ? (cancelOne.variables as string) : null}
                  leavingId={leaveGame.isPending ? (leaveGame.variables as string) : null}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Οι ακυρωμένες κρατήσεις παραμένουν εδώ για 24 ώρες από την ακύρωση.
          </p>
          {cancelledRecent.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">Καμία ακυρωμένη κράτηση τις τελευταίες 24 ώρες.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cancelledRecent.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  isPastDay
                  onCancel={() => {}}
                  onCancelSeries={() => {}}
                  cancelling={false}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


function DayGroup({
  date,
  items,
  today,
  onCancel,
  onCancelSeries,
  onLeave,
  cancellingId,
  leavingId,
}: {
  date: string;
  items: UnifiedItem[];
  today: string;
  onCancel: (id: string) => void;
  onCancelSeries: (seriesId: string) => void;
  onLeave: (openGameId: string) => void;
  cancellingId: string | null;
  leavingId: string | null;
}) {
  const d = new Date(`${date}T12:00:00`);
  const label = d.toLocaleDateString("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const isPastDay = date < today;
  return (
    <section>
      <h3 className="mb-2 px-1 text-sm font-semibold capitalize text-muted-foreground">
        {label}
        {date === today && (
          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Σήμερα
          </span>
        )}
      </h3>
      <ul className="space-y-2">
        {items.map((it) =>
          it.kind === "booking" ? (
            <BookingCard
              key={`b:${it.booking.id}`}
              booking={it.booking}
              isPastDay={isPastDay}
              onCancel={onCancel}
              onCancelSeries={onCancelSeries}
              cancelling={cancellingId === it.booking.id}
            />
          ) : (
            <JoinedGameCard
              key={`g:${it.game.open_game_id}`}
              game={it.game}
              isPastDay={isPastDay}
              onLeave={onLeave}
              leaving={leavingId === it.game.open_game_id}
            />
          ),
        )}
      </ul>
    </section>
  );
}

function JoinedGameCard({
  game,
  isPastDay,
  onLeave,
  leaving,
}: {
  game: MyJoinedGameRow;
  isPastDay: boolean;
  onLeave: (openGameId: string) => void;
  leaving: boolean;
}) {
  const sport = SPORTS.find((s) => s.id === game.sport);
  const end = addHours(game.start_time, game.duration_hours);
  const { t } = useTranslation();
  return (
    <li className="relative rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {sport && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sport.tokenClass}`}>
                {sport.id}
              </span>
            )}
            <span className="font-display text-base font-semibold">
              {game.start_time} – {end}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-secondary">
              <Users className="h-3 w-3" /> {t("bookings.joinedBadge")}
            </span>
          </div>
          <div className="mt-1 text-sm text-foreground">{game.venue?.name ?? "—"}</div>
          {game.court_name && (
            <div className="mt-0.5 text-xs text-muted-foreground">{game.court_name}</div>
          )}
          <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {game.venue?.area ?? ""}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {game.players_count}/{game.max_players}
          </div>
        </div>
        {!isPastDay && (
          <div className="relative z-10 flex flex-col items-end gap-2">
            <button
              disabled={leaving}
              onClick={() => onLeave(game.open_game_id)}
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <LogOut className="h-3 w-3" /> {t("bookings.leave")}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}


function BookingCard({
  booking,
  isPastDay,
  onCancel,
  onCancelSeries,
  cancelling,
}: {
  booking: MyBookingRow;
  isPastDay: boolean;
  onCancel: (id: string) => void;
  onCancelSeries: (seriesId: string) => void;
  cancelling: boolean;
}) {
  const sport = SPORTS.find((s) => s.id === booking.venue?.sport);
  const cancelled = booking.status === "cancelled";
  const future = !isPastDay && !cancelled;
  const end = addHours(booking.start_time, booking.duration_hours);
  const { t } = useTranslation();
  return (
    <li
      className={`relative rounded-2xl border bg-card p-4 transition ${
        cancelled ? "border-border/40 opacity-60" : "border-border/60 cursor-pointer hover:border-primary/40 hover:shadow-sm"
      }`}
    >
      {!cancelled && (
        <Link
          to="/booking/$bookingId"
          params={{ bookingId: booking.id }}
          aria-label={t("bookings.cardAriaLabel")}
          className="absolute inset-0 z-0 rounded-2xl"
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {sport && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sport.tokenClass}`}>
                {sport.id}
              </span>
            )}
            <span className="font-display text-base font-semibold">
              {booking.start_time} – {end}
            </span>
            {booking.series_id && (
              <span className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-secondary">
                <Repeat className="h-3 w-3" /> Επαναλαμβανόμενη
              </span>
            )}
            {booking.type === "phone" && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold">
                Τηλεφωνική
              </span>
            )}
            {cancelled && (
              <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                Ακυρωμένη
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-foreground">
            {booking.venue?.name ?? "—"}
          </div>
          {booking.court_name && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {booking.court_name}
            </div>
          )}
          <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {booking.venue?.area ?? ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-semibold">€{booking.price.toFixed(2)}</div>
          {future && (
            <div className="relative z-10 flex flex-wrap justify-end gap-2">
              <button
                disabled={cancelling}
                onClick={() => onCancel(booking.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Ακύρωση
              </button>
              {booking.series_id && (
                <button
                  onClick={() => onCancelSeries(booking.series_id!)}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3 w-3" /> Όλη η σειρά
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function addHours(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
