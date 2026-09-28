import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Euro,
  Phone,
  Globe,
  Wrench,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  listOwnerVenues,
  getOwnerSchedule,
  cancelBookingAsOwner,
  createOwnerBooking,
  type BookingRow,
  type CourtRow,
  type OwnerVenue,
} from "@/lib/api/owner.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/")({
  head: () => ({ meta: [{ title: "Πίνακας ιδιοκτήτη — Courtsie" }] }),
  component: OwnerDashboard,
});

type SlotInfoLite = { court_id: string; day_of_week: number; start_time: string; end_time: string };


type View = "day" | "week";
type SlotKey = { courtId: string; date: string; hour: string };

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
function toHour(t: string) {
  const [h, m] = t.split(":");
  return Number(h) + Number(m) / 60;
}
function getAthensNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
function isSlotPast(date: string, startTime: string, now: { date: string; minutes: number }): boolean {
  if (date < now.date) return true;
  if (date > now.date) return false;
  const [h, m] = startTime.split(":").map(Number);
  return h * 60 + m <= now.minutes;
}

function OwnerDashboard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const DAY_LABELS = t("days.short", { returnObjects: true }) as string[];

  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [venueId, setVenueId] = useState<string | null>(null);
  const [slot, setSlot] = useState<
    | { kind: "booking"; booking: BookingRow; court: CourtRow }
    | { kind: "empty"; key: SlotKey; court: CourtRow }
    | null
  >(null);

  const venuesQ = useQuery({
    queryKey: ["owner-venues"],
    queryFn: () => listOwnerVenues(),
  });

  const activeVenueId = venueId ?? venuesQ.data?.[0]?.id ?? null;

  const range = useMemo(() => {
    if (view === "day") {
      const s = fmtDate(cursor);
      return { from: s, to: s, days: [new Date(cursor)] };
    }
    const start = startOfWeek(cursor);
    return {
      from: fmtDate(start),
      to: fmtDate(addDays(start, 6)),
      days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    };
  }, [cursor, view]);

  const scheduleQ = useQuery({
    queryKey: ["owner-schedule", activeVenueId, range.from, range.to],
    queryFn: () =>
      getOwnerSchedule({
        data: { venueId: activeVenueId!, dateFrom: range.from, dateTo: range.to },
      }),
    enabled: !!activeVenueId,
  });

  const venue = scheduleQ.data?.venue;
  const courts = scheduleQ.data?.courts ?? [];
  const bookings = scheduleQ.data?.bookings ?? [];
  const allSlots: SlotInfoLite[] = scheduleQ.data?.slots ?? [];

  const todayStr = fmtDate(new Date());
  const dayStats = useMemo(() => {
    const todays = bookings.filter(
      (b) => b.date === todayStr && b.status !== "cancelled",
    );
    const real = todays.filter((b) => b.type !== "closed");
    const revenue = real.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const weekday = new Date(`${todayStr}T12:00:00`).getDay();
    const todaysSlots = allSlots.filter((s) => s.day_of_week === weekday);
    const totalHours = todaysSlots.reduce(
      (s, x) => s + (toHour(x.end_time) - toHour(x.start_time)),
      0,
    );
    const booked = real.reduce((s, b) => s + b.duration_hours, 0);
    const occ = totalHours ? Math.round((booked / totalHours) * 100) : 0;
    return { count: real.length, revenue, occ };
  }, [bookings, allSlots, todayStr]);


  function shift(n: number) {
    setCursor((c) => {
      const next = addDays(c, view === "day" ? n : n * 7);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minAllowed = view === "day" ? today : startOfWeek(today);
      return next < minAllowed ? minAllowed : next;
    });
  }

  const today0 = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const canGoPrev =
    view === "day"
      ? cursor.getTime() > today0.getTime()
      : startOfWeek(cursor).getTime() > startOfWeek(today0).getTime();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("ownerDashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("ownerDashboard.subtitle")}</p>
        </div>
        {venuesQ.data && venuesQ.data.length > 1 && (
          <VenuePicker venues={venuesQ.data} value={activeVenueId} onChange={setVenueId} />
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={CalendarCheck} label={t("ownerDashboard.bookingsToday")} value={String(dayStats.count)} />
        <StatCard icon={Euro} label={t("ownerDashboard.revenueToday")} value={`€${dayStats.revenue.toFixed(0)}`} />
        <StatCard icon={TrendingUp} label={t("ownerDashboard.occupancyToday")} value={`${dayStats.occ}%`} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" disabled={!canGoPrev} onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            {t("ownerDashboard.today")}
          </Button>
          <Button size="icon" variant="outline" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 font-display text-lg font-semibold">
            {view === "day"
              ? cursor.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long" })
              : `${range.days[0].toLocaleDateString(locale, { day: "2-digit", month: "short" })} — ${range.days[6].toLocaleDateString(locale, { day: "2-digit", month: "short" })}`}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/60 p-1">
          <button
            onClick={() => setView("day")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              view === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("ownerDashboard.day")}
          </button>
          <button
            onClick={() => setView("week")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("ownerDashboard.week")}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <LegendDot className="bg-primary/70" label={t("ownerDashboard.legendOnline")} />
        <LegendDot className="bg-sky-500/70" label={t("ownerDashboard.legendPhone")} />
        <LegendDot className="bg-amber-500/70" label={t("ownerDashboard.legendClosed")} />
        <LegendDot className="border border-dashed border-border bg-transparent" label={t("ownerDashboard.legendAvailable")} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border/60 bg-card">
        {!activeVenueId ? (
          <EmptyOwnerState />
        ) : scheduleQ.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : view === "day" ? (
          <DayGrid
            courts={courts}
            bookings={bookings.filter((b) => b.date === range.from)}
            closures={scheduleQ.data?.closures ?? []}
            slots={allSlots}
            date={range.from}
            onSlotClick={(payload) => setSlot(payload)}
          />
        ) : (
          <WeekGrid
            days={range.days}
            courts={courts}
            bookings={bookings}
            closures={scheduleQ.data?.closures ?? []}
            slots={allSlots}
            onSlotClick={(payload) => setSlot(payload)}
            dayLabels={DAY_LABELS}
          />
        )}

      </div>

      {slot && venue && (
        <SlotDialog
          slot={slot}
          venue={venue}
          courts={courts}
          bookings={bookings}
          closures={scheduleQ.data?.closures ?? []}
          slots={scheduleQ.data?.slots ?? []}
          onClose={() => setSlot(null)}
          queryKey={["owner-schedule", activeVenueId, range.from, range.to]}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}

function VenuePicker({ venues, value, onChange }: { venues: OwnerVenue[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <select
      className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {venues.map((v) => (
        <option key={v.id} value={v.id}>{v.name}</option>
      ))}
    </select>
  );
}

function EmptyOwnerState() {
  const { t } = useTranslation();
  return (
    <div className="p-12 text-center">
      <p className="text-sm text-muted-foreground">
        {t("ownerDashboard.empty")}{" "}
        <Link to="/owner/venues" className="text-primary underline">
          {t("ownerDashboard.addFirst")}
        </Link>
        .
      </p>
    </div>
  );
}

type ClosureLite = {
  id: string;
  court_id: string;
  date: string | null;
  weekday: number | null;
  start_time: string;
  end_time: string;
  reason: string | null;
};

function DayGrid({
  courts,
  bookings,
  closures,
  slots,
  date,
  onSlotClick,
}: {
  courts: CourtRow[];
  bookings: BookingRow[];
  closures: ClosureLite[];
  slots: SlotInfoLite[];
  date: string;
  onSlotClick: (p: { kind: "booking"; booking: BookingRow; court: CourtRow } | { kind: "empty"; key: SlotKey; court: CourtRow }) => void;
}) {
  const { t } = useTranslation();
  if (courts.length === 0) {
    return <div className="p-12 text-center text-sm text-muted-foreground">{t("ownerDashboard.noCourts")}</div>;
  }
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const athensNow = getAthensNow();

  return (
    <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `repeat(${courts.length}, minmax(180px,1fr))` }}>
      {courts.map((c) => (
        <div key={c.id} className="border-b border-r border-border/60 p-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {c.name}
        </div>
      ))}
      {courts.map((c) => {
        const courtSlots = slots
          .filter((s) => s.court_id === c.id && s.day_of_week === weekday)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div key={`col-${c.id}`} className="flex flex-col gap-1.5 border-r border-border/40 p-2">
            {courtSlots.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                {t("ownerDashboard.noScheduledSlots", "Καμία προγραμματισμένη ώρα")}
              </div>
            ) : (
              courtSlots.map((s) => {
                const sH = toHour(s.start_time);
                const eH = toHour(s.end_time);
                const booking = bookings.find(
                  (b) =>
                    b.court_id === c.id &&
                    b.status !== "cancelled" &&
                    toHour(b.start_time) < eH &&
                    toHour(b.start_time) + b.duration_hours > sH,
                );
                const closed = !booking && closures.some((cl) => {
                  if (cl.court_id !== c.id) return false;
                  if (cl.date && cl.date !== date) return false;
                  if (!cl.date && cl.weekday !== weekday) return false;
                  return toHour(cl.start_time) < eH && toHour(cl.end_time) > sH;
                });
                const past = isSlotPast(date, s.start_time, athensNow);
                return (
                  <SlotRow
                    key={`${c.id}-${s.start_time}`}
                    start={s.start_time}
                    end={s.end_time}
                    booking={booking}
                    closed={closed}
                    past={past}
                    onClick={() => {
                      if (past) return;
                      if (booking) onSlotClick({ kind: "booking", booking, court: c });
                      else onSlotClick({ kind: "empty", key: { courtId: c.id, date, hour: s.start_time }, court: c });
                    }}
                  />
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotRow({
  start,
  end,
  booking,
  closed,
  past = false,
  onClick,
}: {
  start: string;
  end: string;
  booking?: BookingRow;
  closed: boolean;
  past?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  let tone = "border-dashed border-border/60 bg-transparent hover:bg-primary/5";
  let icon: React.ReactNode = null;
  let label: string = t("ownerDashboard.legendAvailable");
  if (booking) {
    if (booking.type === "online") {
      tone = "bg-primary/20 border-primary/40";
      icon = <Globe className="h-3 w-3" />;
      label = booking.player_name || booking.customer_name || t("ownerDashboard.customerFallback");
    } else if (booking.type === "phone") {
      tone = "bg-sky-500/20 border-sky-500/40";
      icon = <Phone className="h-3 w-3" />;
      label = booking.customer_name || t("ownerDashboard.customerFallback");
    } else {
      tone = "bg-amber-500/20 border-amber-500/40";
      icon = <Wrench className="h-3 w-3" />;
      label = t("ownerDashboard.maintenance");
    }
  } else if (closed) {
    tone = "bg-amber-500/15 border-amber-500/30";
    icon = <Wrench className="h-3 w-3" />;
    label = t("ownerDashboard.legendClosed");
  }
  return (
    <button
      onClick={onClick}
      disabled={past}
      aria-disabled={past}
      title={past ? t("ownerDashboard.slotPast", "πέρασε") : undefined}
      className={cn(
        "flex flex-col gap-0.5 rounded-md border p-2 text-left text-xs transition hover:brightness-110",
        tone,
        past && "pointer-events-none opacity-40 grayscale hover:brightness-100",
      )}
    >
      <span className="font-mono text-[11px] text-muted-foreground">{start}–{end}</span>
      <span className="flex items-center gap-1 truncate font-medium">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {past && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("ownerDashboard.slotPast", "πέρασε")}
        </span>
      )}
    </button>
  );
}


function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SlotCell({ booking, isStart, onClick }: { booking?: BookingRow; isStart: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  if (!booking) {
    return (
      <button
        onClick={onClick}
        className="group min-h-[44px] border-b border-r border-border/40 bg-transparent transition hover:bg-primary/5"
        aria-label={t("ownerDashboard.addSlot")}
      >
        <span className="invisible inline-flex items-center gap-1 text-xs text-primary group-hover:visible">
          <Plus className="h-3 w-3" /> {t("ownerDashboard.add")}
        </span>
      </button>
    );
  }
  const tone =
    booking.type === "online"
      ? "bg-primary/20 border-primary/40 text-primary-foreground"
      : booking.type === "phone"
        ? "bg-sky-500/20 border-sky-500/40 text-sky-100"
        : "bg-amber-500/20 border-amber-500/40 text-amber-100";

  return (
    <button
      onClick={onClick}
      className={cn("min-h-[44px] border-b border-r border-border/40 p-1.5 text-left transition hover:brightness-110", tone)}
    >
      {isStart && (
        <div className="text-[11px] leading-tight">
          <div className="flex items-center gap-1 font-semibold">
            {booking.type === "online" && <Globe className="h-3 w-3" />}
            {booking.type === "phone" && <Phone className="h-3 w-3" />}
            {booking.type === "closed" && <Wrench className="h-3 w-3" />}
            <span className="truncate">
              {booking.type === "closed"
                ? t("ownerDashboard.maintenance")
                : booking.customer_name || booking.player_name || t("ownerDashboard.customerFallback")}
            </span>
          </div>
          <div className="opacity-80">
            {booking.start_time.slice(0, 5)} · {booking.duration_hours}h
          </div>
        </div>
      )}
    </button>
  );
}

function WeekGrid({
  days,
  courts,
  bookings,
  closures,
  slots,
  onSlotClick,
  dayLabels,
}: {
  days: Date[];
  courts: CourtRow[];
  bookings: BookingRow[];
  closures: ClosureLite[];
  slots: SlotInfoLite[];
  onSlotClick: (p: { kind: "booking"; booking: BookingRow; court: CourtRow } | { kind: "empty"; key: SlotKey; court: CourtRow }) => void;
  dayLabels: string[];
}) {
  const { t } = useTranslation();
  if (courts.length === 0) {
    return <div className="p-12 text-center text-sm text-muted-foreground">{t("ownerDashboard.noCourts")}</div>;
  }
  const athensNow = getAthensNow();
  return (
    <div className="grid min-w-[820px] grid-cols-7">
      {days.map((d, i) => {
        const ds = fmtDate(d);
        const weekday = d.getDay();
        const todaysSlots = slots.filter((s) => s.day_of_week === weekday);
        let online = 0, phone = 0, closedN = 0, available = 0;
        const rows: { court: CourtRow; start: string; end: string; booking?: BookingRow; closed: boolean; past: boolean }[] = [];
        for (const c of courts) {
          const courtSlots = todaysSlots
            .filter((s) => s.court_id === c.id)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          for (const s of courtSlots) {
            const sH = toHour(s.start_time), eH = toHour(s.end_time);
            const booking = bookings.find(
              (b) =>
                b.court_id === c.id && b.date === ds && b.status !== "cancelled" &&
                toHour(b.start_time) < eH && toHour(b.start_time) + b.duration_hours > sH,
            );
            const isClosed = !booking && closures.some((cl) => {
              if (cl.court_id !== c.id) return false;
              if (cl.date && cl.date !== ds) return false;
              if (!cl.date && cl.weekday !== weekday) return false;
              return toHour(cl.start_time) < eH && toHour(cl.end_time) > sH;
            });
            const past = isSlotPast(ds, s.start_time, athensNow);
            if (booking?.type === "online") online++;
            else if (booking?.type === "phone") phone++;
            else if (booking?.type === "closed" || isClosed) closedN++;
            else if (!past) available++;
            rows.push({ court: c, start: s.start_time, end: s.end_time, booking, closed: isClosed, past });
          }
        }
        const total = rows.length;
        return (
          <div key={ds} className="flex flex-col border-b border-r border-border/40">
            <div className="border-b border-border/60 bg-card/60 p-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dayLabels[i]} {d.getDate()}/{d.getMonth() + 1}
            </div>
            <div className="flex-1 space-y-1 p-2">
              {total === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground">
                  {t("ownerDashboard.noScheduledSlots", "Καμία προγραμματισμένη ώρα")}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {online > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-primary/25 px-1 py-0.5 font-semibold">
                        <Globe className="h-3 w-3" /> {online}
                      </span>
                    )}
                    {phone > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/25 px-1 py-0.5 font-semibold">
                        <Phone className="h-3 w-3" /> {phone}
                      </span>
                    )}
                    {closedN > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/25 px-1 py-0.5 font-semibold">
                        <Wrench className="h-3 w-3" /> {closedN}
                      </span>
                    )}
                    {available > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-dashed border-border px-1 py-0.5">
                        {available} {t("ownerDashboard.legendAvailable")}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 pt-1">
                    {rows.map((r) => {
                      const tone =
                        r.booking?.type === "online" ? "bg-primary/15 border-primary/30"
                        : r.booking?.type === "phone" ? "bg-sky-500/15 border-sky-500/30"
                        : r.booking?.type === "closed" || r.closed ? "bg-amber-500/15 border-amber-500/30"
                        : "border-dashed border-border/60";
                      return (
                        <button
                          key={`${r.court.id}-${r.start}`}
                          disabled={r.past}
                          aria-disabled={r.past}
                          title={r.past ? t("ownerDashboard.slotPast", "πέρασε") : undefined}
                          onClick={() => {
                            if (r.past) return;
                            if (r.booking) onSlotClick({ kind: "booking", booking: r.booking, court: r.court });
                            else onSlotClick({ kind: "empty", key: { courtId: r.court.id, date: ds, hour: r.start }, court: r.court });
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-1 rounded border px-1.5 py-1 text-left text-[10px] transition hover:brightness-110",
                            tone,
                            r.past && "pointer-events-none opacity-40 grayscale hover:brightness-100",
                          )}
                        >
                          <span className="font-mono">{r.start}</span>
                          <span className="truncate text-muted-foreground">
                            {r.past ? t("ownerDashboard.slotPast", "πέρασε") : r.court.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>

  );
}

type SlotInfo = { court_id: string; day_of_week: number; start_time: string; end_time: string };
type ClosureInfo = { id: string; court_id: string; date: string | null; weekday: number | null; start_time: string; end_time: string; reason: string | null };

function SlotDialog({
  slot,
  venue,
  courts,
  bookings,
  closures,
  slots,
  onClose,
  queryKey,
}: {
  slot: { kind: "booking"; booking: BookingRow; court: CourtRow } | { kind: "empty"; key: SlotKey; court: CourtRow };
  venue: OwnerVenue;
  courts: CourtRow[];
  bookings: BookingRow[];
  closures: ClosureInfo[];
  slots: SlotInfo[];
  onClose: () => void;
  queryKey: any[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelBookingAsOwner);
  const createFn = useServerFn(createOwnerBooking);

  const cancelMut = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId } }),
    onSuccess: () => {
      toast.success(t("ownerDashboard.cancelled"));
      qc.invalidateQueries({ queryKey });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? t("common.error")),
  });

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof createFn>[0]["data"]) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success(t("ownerDashboard.createdOk"));
      qc.invalidateQueries({ queryKey });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? t("common.error")),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {slot.kind === "booking" ? (
          <BookingDetails
            booking={slot.booking}
            court={slot.court}
            onCancel={() => cancelMut.mutate(slot.booking.id)}
            cancelling={cancelMut.isPending}
            onClose={onClose}
          />
        ) : (
          <EmptySlotActions
            slot={slot.key}
            venue={venue}
            courts={courts}
            bookings={bookings}
            closures={closures}
            slots={slots}
            onSubmit={(payload) => createMut.mutate(payload)}
            submitting={createMut.isPending}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingDetails({
  booking,
  court,
  onCancel,
  cancelling,
  onClose,
}: {
  booking: BookingRow;
  court: CourtRow;
  onCancel: () => void;
  cancelling: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const TYPE_LABEL: Record<BookingRow["type"], string> = {
    online: t("ownerBookings.badge.online"),
    phone: t("ownerBookings.badge.phone"),
    closed: t("ownerBookings.badge.closed"),
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("ownerDashboard.details.kind", { type: TYPE_LABEL[booking.type] })}</DialogTitle>
        <DialogDescription>
          {court.name} · {booking.date} · {booking.start_time.slice(0, 5)} · {booking.duration_hours}h
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 text-sm">
        {booking.player_id ? (
          // Registered player: name + avatar open the owner-facing player
          // profile (rating, level, history at this owner's venues; phone
          // only while an active booking exists — enforced server-side).
          <Link
            to="/owner/players/$playerId"
            params={{ playerId: booking.player_id }}
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/60 hover:bg-primary/5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {booking.player_photo_url ? (
                <img src={booking.player_photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (booking.player_name || booking.customer_name || "?").charAt(0).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {booking.player_name || booking.customer_name || t("ownerDashboard.customerFallback")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("ownerDashboard.details.viewPlayer")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          (booking.customer_name || booking.player_name) && (
            <Row label={t("ownerDashboard.details.customer")} value={booking.customer_name || booking.player_name!} />
          )
        )}
        {booking.customer_phone && (
          <Row label={t("ownerDashboard.details.phone")} value={booking.customer_phone} />
        )}
        <Row label={t("ownerDashboard.details.status")} value={booking.status} />
        <Row label={t("ownerDashboard.details.price")} value={`€${Number(booking.price).toFixed(2)}`} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("ownerDashboard.details.close")}</Button>
        {booking.status !== "cancelled" && (
          <Button variant="destructive" onClick={onCancel} disabled={cancelling}>
            <X className="mr-1 h-4 w-4" />
            {cancelling ? t("ownerDashboard.details.cancelling") : t("ownerDashboard.details.cancel")}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

type CreatePayload = {
  venueId: string;
  courtId: string;
  date: string;
  startTime: string;
  durationHours: number;
  type: "phone" | "closed";
  customerName?: string;
  customerPhone?: string;
  price?: number;
  paymentMethod?: "cash";
  reason?: string;
};

function EmptySlotActions({
  slot,
  venue,
  courts,
  bookings,
  closures,
  slots,
  onSubmit,
  submitting,
  onClose,
}: {
  slot: SlotKey;
  venue: OwnerVenue;
  courts: CourtRow[];
  bookings: BookingRow[];
  closures: ClosureInfo[];
  slots: SlotInfo[];
  onSubmit: (p: CreatePayload) => void;
  submitting: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"menu" | "phone" | "closed">("menu");

  if (mode === "menu") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("ownerDashboard.newAction")}</DialogTitle>
          <DialogDescription>{slot.date} · {slot.hour}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <button
            onClick={() => setMode("phone")}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition hover:border-primary/60 hover:bg-primary/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">{t("ownerDashboard.newPhone")}</span>
              <span className="block text-xs text-muted-foreground">{t("ownerDashboard.newPhoneDesc")}</span>
            </span>
          </button>
          <button
            onClick={() => setMode("closed")}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition hover:border-amber-500/60 hover:bg-amber-500/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
              <Wrench className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">{t("ownerDashboard.closeSlot")}</span>
              <span className="block text-xs text-muted-foreground">{t("ownerDashboard.closeSlotDesc")}</span>
            </span>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("ownerDashboard.details.close")}</Button>
        </DialogFooter>
      </>
    );
  }

  if (mode === "phone") {
    return <PhoneBookingForm slot={slot} venue={venue} courts={courts} bookings={bookings} closures={closures} slots={slots} onBack={() => setMode("menu")} onSubmit={onSubmit} submitting={submitting} />;
  }

  return <ClosedSlotForm slot={slot} venue={venue} courts={courts} onBack={() => setMode("menu")} onSubmit={onSubmit} submitting={submitting} />;
}

function PhoneBookingForm({
  slot,
  venue,
  courts,
  bookings,
  closures,
  slots,
  onBack,
  onSubmit,
  submitting,
}: {
  slot: SlotKey;
  venue: OwnerVenue;
  courts: CourtRow[];
  bookings: BookingRow[];
  closures: ClosureInfo[];
  slots: SlotInfo[];
  onBack: () => void;
  onSubmit: (p: CreatePayload) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(slot.date);
  const [courtId, setCourtId] = useState(slot.courtId);
  const payment = "cash" as const;
  const [error, setError] = useState<string | null>(null);

  // Single source of truth: court_slots for the chosen court+day, minus busy/closed/past
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const todayIso = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();
  const hoursOf = (t: string) => { const [h, m] = t.split(":"); return Number(h) + Number(m) / 60; };

  const availableSlots = useMemo(() => {
    const courtSlots = slots
      .filter((s) => s.court_id === courtId && s.day_of_week === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return courtSlots.filter((s) => {
      const start = hoursOf(s.start_time);
      const end = hoursOf(s.end_time);
      // past?
      if (date === todayIso) {
        const [hh, mm] = s.start_time.split(":");
        const sd = new Date(); sd.setHours(Number(hh), Number(mm), 0, 0);
        if (sd.getTime() <= nowMs + 5 * 60_000) return false;
      }
      // booking overlap on same court
      for (const b of bookings) {
        if (b.court_id !== courtId || b.date !== date || b.status === "cancelled") continue;
        const bs = hoursOf(b.start_time);
        if (bs < end && bs + b.duration_hours > start) return false;
      }
      // closure overlap
      for (const c of closures) {
        if (c.court_id !== courtId) continue;
        if (c.date && c.date !== date) continue;
        if (!c.date && c.weekday !== weekday) continue;
        const cs = hoursOf(c.start_time);
        const ce = hoursOf(c.end_time);
        if (cs < end && ce > start) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, bookings, closures, courtId, date, weekday]);

  const [startTime, setStartTime] = useState<string>(
    availableSlots.find((s) => s.start_time === slot.hour)?.start_time ?? availableSlots[0]?.start_time ?? "",
  );
  // Keep startTime in sync if the picked court/date changes the list
  if (startTime && !availableSlots.some((s) => s.start_time === startTime)) {
    const next = availableSlots[0]?.start_time ?? "";
    if (next !== startTime) setStartTime(next);
  } else if (!startTime && availableSlots[0]) {
    setStartTime(availableSlots[0].start_time);
  }

  const pickedSlot = availableSlots.find((s) => s.start_time === startTime);
  const duration = pickedSlot ? hoursOf(pickedSlot.end_time) - hoursOf(pickedSlot.start_time) : 0;
  const price = venue.base_price_per_hour * duration;

  function submit() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) return setError(t("ownerDashboard.errNameRequired"));
    if (trimmedName.length > 120) return setError(t("ownerDashboard.errNameLen"));
    if (!trimmedPhone) return setError(t("ownerDashboard.errPhoneRequired", "Συμπλήρωσε τηλέφωνο πελάτη"));
    if (trimmedPhone.length < 6) return setError(t("ownerDashboard.errPhoneShort", "Το τηλέφωνο πρέπει να έχει τουλάχιστον 6 χαρακτήρες"));
    if (trimmedPhone.length > 40) return setError(t("ownerDashboard.errPhoneLen"));
    if (!startTime || !pickedSlot) return setError(t("ownerDashboard.errNoSlot", "Επίλεξε διαθέσιμη ώρα"));
    setError(null);
    onSubmit({
      venueId: venue.id,
      courtId,
      date,
      startTime,
      durationHours: duration,
      type: "phone",
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      price,
      paymentMethod: payment,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-sky-400" /> {t("ownerDashboard.phoneTitle")}
        </DialogTitle>
        <DialogDescription>{t("ownerDashboard.phoneDesc")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <Field label={t("ownerDashboard.customerName")}>
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t("ownerDashboard.customerNamePh")} />
        </Field>
        <Field label={t("ownerDashboard.phone")}>
          <Input value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} placeholder={t("ownerDashboard.phonePh")} inputMode="tel" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ownerDashboard.court")}>
            <SelectNative value={courtId} onChange={setCourtId}>
              {courts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </SelectNative>
          </Field>
          <Field label={t("ownerDashboard.date")}>
            <Input type="date" min={fmtDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ownerDashboard.time")}>
            {availableSlots.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t("ownerBookings.dialog.noSlots", "Καμία ελεύθερη ώρα")}
              </div>
            ) : (
              <SelectNative value={startTime} onChange={setStartTime}>
                {availableSlots.map((s) => (
                  <option key={s.start_time} value={s.start_time}>
                    {s.start_time}–{s.end_time}
                  </option>
                ))}
              </SelectNative>
            )}
          </Field>
          <Field label={t("ownerDashboard.duration")}>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
              {duration ? `${duration}h` : "—"}
            </div>
          </Field>
        </div>
        <Field label={t("ownerDashboard.payment")}>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm">
            <Euro className="h-4 w-4 text-primary" />
            <span className="font-medium">{t("ownerDashboard.cash")}</span>
          </div>
        </Field>
        <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm">
          {t("ownerDashboard.total")}: <span className="font-display font-bold">€{price.toFixed(2)}</span>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>{t("ownerDashboard.back")}</Button>
        <Button disabled={submitting || availableSlots.length === 0} onClick={submit}>
          {submitting ? t("ownerDashboard.saving") : t("ownerDashboard.submit")}
        </Button>
      </DialogFooter>
    </>
  );
}

function ClosedSlotForm({
  slot,
  venue,
  courts,
  onBack,
  onSubmit,
  submitting,
}: {
  slot: SlotKey;
  venue: OwnerVenue;
  courts: CourtRow[];
  onBack: () => void;
  onSubmit: (p: CreatePayload) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const REASONS = [
    { key: "maintenance", label: t("ownerDashboard.reasonMaintenance") },
    { key: "private", label: t("ownerDashboard.reasonPrivate") },
    { key: "tournament", label: t("ownerDashboard.reasonTournament") },
    { key: "other", label: t("ownerDashboard.reasonOther") },
  ];
  const [reasonChoice, setReasonChoice] = useState<string>(REASONS[0].key);
  const [customReason, setCustomReason] = useState("");
  const [date, setDate] = useState(slot.date);
  const [hour, setHour] = useState(slot.hour);
  const [courtId, setCourtId] = useState(slot.courtId);
  const [duration, setDuration] = useState(1);

  function submit() {
    const selected = REASONS.find((r) => r.key === reasonChoice)!;
    const reason = reasonChoice === "other" ? customReason.trim() : selected.label;
    onSubmit({
      venueId: venue.id,
      courtId,
      date,
      startTime: hour,
      durationHours: duration,
      type: "closed",
      reason: reason.slice(0, 200) || t("ownerBookings.badge.closed"),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-amber-400" /> {t("ownerDashboard.closedTitle")}
        </DialogTitle>
        <DialogDescription>{t("ownerDashboard.closedDesc")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <Field label={t("ownerDashboard.reason")}>
          <SelectNative value={reasonChoice} onChange={setReasonChoice}>
            {REASONS.map((r) => (<option key={r.key} value={r.key}>{r.label}</option>))}
          </SelectNative>
        </Field>
        {reasonChoice === "other" && (
          <Field label={t("ownerDashboard.description")}>
            <Input value={customReason} maxLength={200} onChange={(e) => setCustomReason(e.target.value)} placeholder={t("ownerDashboard.descPh")} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ownerDashboard.date")}>
            <Input type="date" min={fmtDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("ownerDashboard.time")}>
            <Input type="time" value={hour} onChange={(e) => setHour(e.target.value)} step={1800} />
          </Field>

        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ownerDashboard.court")}>
            <SelectNative value={courtId} onChange={setCourtId}>
              {courts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </SelectNative>
          </Field>
          <Field label={t("ownerDashboard.duration")}>
            <SelectNative value={String(duration)} onChange={(v) => setDuration(Number(v))}>
              <option value="1">{t("ownerDashboard.h1")}</option>
              <option value="1.5">{t("ownerDashboard.h1_5")}</option>
              <option value="2">{t("ownerDashboard.h2")}</option>
            </SelectNative>
          </Field>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>{t("ownerDashboard.back")}</Button>
        <Button disabled={submitting} onClick={submit}>
          {submitting ? t("ownerDashboard.saving") : t("ownerDashboard.closeSubmit")}
        </Button>
      </DialogFooter>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SelectNative({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      {children}
    </select>
  );
}
