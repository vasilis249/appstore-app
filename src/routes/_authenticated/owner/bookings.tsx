import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Phone,
  Lock,
  Calendar as CalIcon,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Users,
  X,
} from "lucide-react";
import {
  listOwnerVenues,
  getOwnerSchedule,
  createOwnerBooking,
  cancelBookingAsOwner,
  type BookingRow,
  type CourtRow,
} from "@/lib/api/owner.functions";
import { useBookingsRealtime } from "@/hooks/use-bookings-realtime";

export const Route = createFileRoute("/_authenticated/owner/bookings")({
  head: () => ({ meta: [{ title: "Κρατήσεις γηπέδων — Courtsie" }] }),
  component: OwnerBookingsPage,
});

const venuesQuery = queryOptions({
  queryKey: ["owner-venues"],
  queryFn: () => listOwnerVenues(),
});

const scheduleQuery = (venueId: string, date: string) =>
  queryOptions({
    queryKey: ["owner-schedule", venueId, date],
    queryFn: () => getOwnerSchedule({ data: { venueId, dateFrom: date, dateTo: date } }),
    enabled: !!venueId,
  });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextDays(n: number, locale: string) {
  const out: { iso: string; label: string; weekday: string }[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(locale, { day: "2-digit", month: "short" }),
      weekday:
        i === 0
          ? locale.startsWith("el") ? "Σήμερα" : "Today"
          : i === 1
            ? locale.startsWith("el") ? "Αύριο" : "Tomorrow"
            : d.toLocaleDateString(locale, { weekday: "short" }),
    });
  }
  return out;
}

const SLOT_ENABLED: Record<string, boolean> = {
  padel: true, tennis: true, basketball: false, football: false, volleyball: false, beach_volley: false,
};

function OwnerBookingsPage() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const qc = useQueryClient();

  const [venueId, setVenueId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"active" | "cancelled">("active");

  const { data: venues, isLoading: venuesLoading } = useQuery(venuesQuery);
  useMemo(() => {
    if (!venueId && venues && venues.length > 0) setVenueId(venues[0].id);
  }, [venues, venueId]);

  const schedule = useQuery(scheduleQuery(venueId, date));
  useBookingsRealtime(venueId, [["owner-schedule", venueId, date], ["owner-schedule", venueId]]);

  const days = useMemo(() => nextDays(14, locale), [locale]);

  const cancelFn = useServerFn(cancelBookingAsOwner);
  const cancelMut = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-schedule", venueId] }),
  });

  const sport = schedule.data?.venue.sport ?? "";
  const slotEnabled = SLOT_ENABLED[sport] ?? false;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("ownerBookings.title", "Κρατήσεις")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("ownerBookings.subtitle", "Όλες οι κρατήσεις στα γήπεδά σου σε πραγματικό χρόνο.")}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!venueId}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {t("ownerBookings.newPhone", "Νέα τηλεφωνική")}
        </button>
      </header>

      {/* Venue selector */}
      <div className="flex flex-wrap items-center gap-2">
        {venuesLoading ? (
          <span className="text-sm text-muted-foreground">{t("common.loading", "Φόρτωση…")}</span>
        ) : venues?.length ? (
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("ownerBookings.noVenues", "Δεν έχεις ακόμη γήπεδα.")}
          </span>
        )}
      </div>

      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const active = d.iso === date;
          return (
            <button
              key={d.iso}
              onClick={() => setDate(d.iso)}
              className={`flex min-w-[84px] flex-col items-center rounded-2xl border px-3 py-2 transition ${
                active ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/40"
              }`}
            >
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.weekday}</span>
              <span className="font-display text-lg font-bold">{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-border/60 bg-card p-1">
        <button
          onClick={() => setTab("active")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("ownerBookings.tabs.active", "Ενεργές")}
        </button>
        <button
          onClick={() => setTab("cancelled")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === "cancelled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("ownerBookings.tabs.cancelled", "Ακυρωμένες")}
        </button>
      </div>

      {/* Bookings list */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 p-4">
          <CalIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">
            {tab === "active"
              ? t("ownerBookings.dayHeading", "Κρατήσεις ημέρας")
              : t("ownerBookings.cancelledHeading", "Ακυρωμένες (τελευταίες 24 ώρες)")}
          </h2>
        </div>
        {(() => {
          const all = schedule.data?.bookings ?? [];
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const visible =
            tab === "active"
              ? all.filter((b) => b.status !== "cancelled")
              : all.filter(
                  (b) =>
                    b.status === "cancelled" &&
                    b.cancelled_at &&
                    new Date(b.cancelled_at).getTime() >= cutoff,
                );
          if (schedule.isLoading) {
            return (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading", "Φόρτωση…")}
              </div>
            );
          }
          if (visible.length === 0) {
            return (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {tab === "active"
                  ? t("ownerBookings.empty", "Καμία κράτηση γι' αυτή την ημέρα.")
                  : t("ownerBookings.cancelledEmpty", "Καμία ακυρωμένη κράτηση τις τελευταίες 24 ώρες.")}
              </div>
            );
          }
          return (
            <ul className="divide-y divide-border/60">
              {[...visible]
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((b) => (
                  <BookingItem
                    key={b.id}
                    booking={b}
                    courts={schedule.data!.courts}
                    onCancel={() => cancelMut.mutate(b.id)}
                    canceling={cancelMut.isPending}
                  />
                ))}
            </ul>
          );
        })()}
      </section>

      {showForm && venueId && schedule.data && (
        <PhoneBookingDialog
          venueId={venueId}
          date={date}
          courts={schedule.data.courts}
          bookings={schedule.data.bookings}
          closures={schedule.data.closures ?? []}
          slots={schedule.data.slots ?? []}
          slotEnabled={slotEnabled}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["owner-schedule", venueId] });
          }}
        />
      )}

    </div>
  );
}

function BookingItem({
  booking,
  courts,
  onCancel,
  canceling,
}: {
  booking: BookingRow;
  courts: CourtRow[];
  onCancel: () => void;
  canceling: boolean;
}) {
  const { t } = useTranslation();
  const court = courts.find((c) => c.id === booking.court_id);
  const isPhone = booking.type === "phone";
  const isClosed = booking.type === "closed";
  const isCancelled = booking.status === "cancelled";
  const badgeClass = isClosed
    ? "bg-slate-500/15 text-slate-600 dark:text-slate-300"
    : isPhone
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  const badgeLabel = isClosed
    ? t("ownerBookings.badge.closed", "Κλειστό")
    : isPhone
      ? t("ownerBookings.badge.phone", "Τηλεφωνική")
      : t("ownerBookings.badge.online", "Online");

  return (
    <li className={`flex flex-wrap items-center gap-3 p-4 ${isCancelled ? "opacity-50" : ""}`}>
      <div className="flex w-20 flex-col">
        <span className="font-display text-lg font-bold">{booking.start_time.slice(0, 5)}</span>
        <span className="text-xs text-muted-foreground">
          {booking.duration_hours}h · {court?.name ?? "—"}
        </span>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
        {isPhone ? <Phone className="h-3 w-3" /> : isClosed ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
        {badgeLabel}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="truncate font-medium">
          {booking.customer_name ?? booking.player_name ?? "—"}
        </div>
        {booking.customer_phone && (
          <div className="text-xs text-muted-foreground">{booking.customer_phone}</div>
        )}
      </div>
      <div className="text-sm font-semibold">€{booking.price.toFixed(2)}</div>
      {!isCancelled && (
        <button
          onClick={onCancel}
          disabled={canceling}
          className="rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
          {t("ownerBookings.cancel", "Ακύρωση")}
        </button>
      )}
    </li>
  );
}

function PhoneBookingDialog({
  venueId,
  date,
  courts,
  bookings,
  closures,
  slots,
  slotEnabled,
  onClose,
  onCreated,
}: {
  venueId: string;
  date: string;
  courts: CourtRow[];
  bookings: BookingRow[];
  closures: { court_id: string; start_time: string; end_time: string; date: string | null; weekday: number | null }[];
  slots: { court_id: string; day_of_week: number; start_time: string; end_time: string }[];
  slotEnabled: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const selectedCourt = courts.find((c) => c.id === courtId);
  const sport = selectedCourt?.sport ?? "padel";
  const fixedDuration = sport === "padel" ? 1.5 : null;
  const [mode, setMode] = useState<"whole" | "slot">("whole");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const toHour = (t: string) => {
    const [h, m] = t.split(":");
    return Number(h) + Number(m) / 60;
  };
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // Single source of truth: only slots configured by the owner for this weekday
  const sameSportCourts = courts.filter((c) => c.sport === sport);
  const sameSportCourtIds = new Set(sameSportCourts.map((c) => c.id));
  const courtSlotsForCourt = slots.filter(
    (s) => s.day_of_week === weekday && (mode === "whole" ? s.court_id === courtId : sameSportCourtIds.has(s.court_id)),
  );

  // Group by start_time → eligible court ids + longest end
  const byStart = new Map<string, { courtIds: string[]; end: string }>();
  for (const s of courtSlotsForCourt) {
    const cur = byStart.get(s.start_time);
    if (cur) {
      cur.courtIds.push(s.court_id);
      if (s.end_time > cur.end) cur.end = s.end_time;
    } else {
      byStart.set(s.start_time, { courtIds: [s.court_id], end: s.end_time });
    }
  }
  const allSlots = Array.from(byStart.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  function slotState(time: string): "free" | "busy" | "past" {
    const info = byStart.get(time)!;
    const start = toHour(time);
    const end = toHour(info.end);
    if (date === today) {
      const sd = new Date();
      const [hh, mm] = time.split(":");
      sd.setHours(Number(hh), Number(mm), 0, 0);
      if (sd.getTime() <= now.getTime() + 5 * 60_000) return "past";
    }
    const busyOn = (cid: string) => {
      for (const b of bookings) {
        if (b.court_id !== cid || b.status === "cancelled") continue;
        const s = toHour(b.start_time);
        if (s < end && s + b.duration_hours > start) return true;
      }
      for (const c of closures) {
        if (c.court_id !== cid) continue;
        if (c.date && c.date !== date && c.weekday !== weekday) continue;
        const cs = toHour(c.start_time);
        const ce = toHour(c.end_time);
        if (cs < end && ce > start) return true;
      }
      return false;
    };
    if (mode === "slot") {
      return info.courtIds.some((c) => !busyOn(c)) ? "free" : "busy";
    }
    return courtId && info.courtIds.includes(courtId) && !busyOn(courtId) ? "free" : "busy";
  }

  const visibleSlots = allSlots
    .map(([time]) => ({ time, state: slotState(time) }))
    .filter((s) => s.state === "free");

  const [startTime, setStartTime] = useState<string>("");
  if (!startTime && visibleSlots[0]) setStartTime(visibleSlots[0].time);
  if (startTime && !visibleSlots.some((s) => s.time === startTime)) {
    if (visibleSlots[0]) setStartTime(visibleSlots[0].time);
    else if (startTime !== "") setStartTime("");
  }

  // Duration derived from the picked slot (or padel-fixed)
  const pickedSlotEnd = startTime ? byStart.get(startTime)?.end : undefined;
  const slotDur = pickedSlotEnd ? toHour(pickedSlotEnd) - toHour(startTime) : null;
  const duration = fixedDuration ?? slotDur ?? 1;

  const createFn = useServerFn(createOwnerBooking);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          venueId,
          courtId,
          date,
          startTime,
          durationHours: duration,
          type: "phone",
          mode,
          customerName: name || undefined,
          customerPhone: phone || undefined,
        },
      }),
    onSuccess: () => onCreated(),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("ownerBookings.dialog.title", "Νέα τηλεφωνική κράτηση")}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label={t("ownerBookings.dialog.court", "Γήπεδο")}>
            <select
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ownerBookings.dialog.start", "Ώρα")}>
              {visibleSlots.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {t("ownerBookings.dialog.noSlots", "Καμία ελεύθερη ώρα")}
                </div>
              ) : (
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {visibleSlots.map((s) => (
                    <option key={s.time} value={s.time}>{s.time}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("ownerBookings.dialog.duration", "Διάρκεια (ώρες)")}>
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
                {duration}h
              </div>
            </Field>
          </div>



          <Field label={t("ownerBookings.dialog.type", "Τύπος κράτησης")}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("whole")}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  mode === "whole" ? "border-primary bg-primary/10" : "border-border/60"
                }`}
              >
                <div className="font-semibold">{t("ownerBookings.dialog.whole", "Ολόκληρο γήπεδο")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("ownerBookings.dialog.wholeDesc", "Κλειδώνει όλο το slot")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => slotEnabled && setMode("slot")}
                disabled={!slotEnabled}
                className={`rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                  mode === "slot" ? "border-primary bg-primary/10" : "border-border/60"
                }`}
              >
                <div className="font-semibold">{t("ownerBookings.dialog.slot", "Μία θέση")}</div>
                <div className="text-xs text-muted-foreground">
                  {slotEnabled
                    ? t("ownerBookings.dialog.slotDesc", "Μετράει στη χωρητικότητα του slot")
                    : t("ownerBookings.dialog.slotUnavailable", "Δεν υποστηρίζεται για αυτό το άθλημα")}
                </div>
              </button>
            </div>
          </Field>

          <Field label={`${t("ownerBookings.dialog.customer", "Όνομα πελάτη")} *`}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={t("ownerBookings.dialog.customerPh", "π.χ. Γιώργος Παπαδόπουλος")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label={`${t("ownerBookings.dialog.phone", "Τηλέφωνο")} *`}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              placeholder="69xxxxxxxx"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>

          {err && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {err}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            {t("common.cancel", "Άκυρο")}
          </button>
          <button
            onClick={() => {
              setErr(null);
              if (name.trim().length < 2) { setErr(t("ownerBookings.dialog.nameRequired", "Συμπλήρωσε όνομα πελάτη")); return; }
              if (phone.trim().length < 6) { setErr(t("ownerBookings.dialog.phoneRequired", "Συμπλήρωσε έγκυρο τηλέφωνο")); return; }
              if (!startTime) { setErr(t("ownerBookings.dialog.noSlots", "Καμία ελεύθερη ώρα")); return; }
              mut.mutate();
            }}
            disabled={mut.isPending || !courtId || !startTime || name.trim().length < 2 || phone.trim().length < 6}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t("ownerBookings.dialog.save", "Καταχώρηση")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
