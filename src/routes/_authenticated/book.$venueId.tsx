import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Calendar as CalIcon,
  Clock,
  Users,
  Trophy,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Sparkles,
  Check,
} from "lucide-react";
import { getVenue } from "@/lib/api/venues.functions";
import {
  getVenueAvailability,
  createBooking,
  SPORT_SLOT_CONFIG,
  FIXED_DURATION,
  type DurationHours,
} from "@/lib/api/bookings.functions";
import { createRecurringBookings } from "@/lib/api/player-bookings.functions";
import { listVenueEquipment } from "@/lib/api/equipment.functions";
import { toast } from "sonner";
import { SPORTS, type Sport } from "@/lib/sports";

import { useRedirectOwnersAway } from "@/hooks/use-redirect-owners-away";
import { useBookingsRealtime } from "@/hooks/use-bookings-realtime";

const searchSchema = z.object({
  mode: z.enum(["slot", "whole"]).optional(),
});

const venueQuery = (id: string) =>
  queryOptions({
    queryKey: ["venue", id],
    queryFn: () => getVenue({ data: { id } }),
  });

const availabilityQuery = (venueId: string, date: string) =>
  queryOptions({
    queryKey: ["availability", venueId, date],
    queryFn: () => getVenueAvailability({ data: { venueId, date } }),
  });

export const Route = createFileRoute("/_authenticated/book/$venueId")({
  validateSearch: searchSchema,
  loader: ({ context, params }) => context.queryClient.ensureQueryData(venueQuery(params.venueId)),
  head: () => ({ meta: [{ title: "Κράτηση γηπέδου — Courtsie" }] }),
  errorComponent: ErrView,
  notFoundComponent: NotFoundView,
  component: BookingPage,
});

function ErrView({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <h1 className="text-xl font-semibold">{t("booking.errorTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  );
}
function NotFoundView() {
  const { t } = useTranslation();
  return <div className="p-8">{t("booking.notFound")}</div>;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeRecurringReason(reason?: string) {
  const raw = (reason ?? "").trim();
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("no_court")) return "no_court";
  if (lower.includes("past_slot")) return "past_slot";
  if (lower.includes("user_overlap")) return "user_overlap";
  if (lower.includes("slot_full")) return "slot_full";
  if (lower.includes("venue_not_found")) return "venue_not_found";
  return raw;
}

function nextDays(n: number, locale: string, todayLabel: string, tomorrowLabel: string) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    out.push({
      iso,
      label: d.toLocaleDateString(locale, { day: "2-digit", month: "short" }),
      weekday: i === 0 ? todayLabel : i === 1 ? tomorrowLabel : d.toLocaleDateString(locale, { weekday: "short" }),
    });
  }
  return out;
}

function BookingPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const { venueId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useRedirectOwnersAway();

  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  if (!venue) return null;

  const sport = venue.sport as Sport;
  const sportMeta = SPORTS.find((s) => s.id === sport)!;
  const sportLabel = t(`sports.${sport}`);
  const cfg = SPORT_SLOT_CONFIG[sport];
  const fixedDuration = FIXED_DURATION[sport];

  const [mode, setMode] = useState<"slot" | "whole">(search.mode ?? cfg.defaultMode);
  const [date, setDate] = useState<string>(todayISO());
  const [duration, setDuration] = useState<DurationHours>(
    (fixedDuration as DurationHours) ?? 1,
  );
  const [startTime, setStartTime] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(false);
  const [recurWeeks, setRecurWeeks] = useState(4);
  const [selectedEquip, setSelectedEquip] = useState<Set<string>>(new Set());
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null); // null = all courts

  if (fixedDuration && duration !== fixedDuration) {
    setDuration(fixedDuration as DurationHours);
  }

  const equipmentQ = useQuery({
    queryKey: ["venue-equipment", venueId],
    queryFn: () => listVenueEquipment({ data: { venueId } }),
  });
  const equipment = equipmentQ.data ?? [];
  const equipmentTotal = equipment
    .filter((e) => selectedEquip.has(e.id))
    .reduce((s, e) => s + e.price, 0);

  const days = useMemo(
    () => nextDays(7, locale, t("booking.today"), t("booking.tomorrow")),
    [locale, t],
  );
  const { data: availability, isLoading: availLoading } = useQuery(availabilityQuery(venueId, date));
  useBookingsRealtime(venueId, [["availability", venueId, date], ["availability", venueId]]);

  // price is computed below with effectiveDuration

  // Use server-computed availability. When a court is selected, use that
  // court's per-court state; otherwise use the aggregate "all courts" view.
  const slots = useMemo(() => {
    type Slot = {
      time: string;
      duration: number;
      available: boolean;
      unavailableReason?: "booked" | "full";
      slotPlayers?: { count: number; max: number };
    };
    const arr: Slot[] = [];
    if (!availability) return arr;

    // "Now" in Europe/Athens — must match the server's past-slot guard.
    const athensParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const getPart = (t: string) => athensParts.find((p) => p.type === t)!.value;
    const athensToday = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const athensNowMin = Number(getPart("hour")) * 60 + Number(getPart("minute"));

    const isPast = (time: string) => {
      if (date !== athensToday) return false;
      const [hh, mm] = time.split(":").map(Number);
      return hh * 60 + mm <= athensNowMin + 5;
    };

    if (selectedCourtId) {
      const courtRow = availability.court_availability.find(
        (c) => c.court_id === selectedCourtId,
      );
      if (!courtRow) return arr;
      for (const s of courtRow.starts) {
        if (isPast(s.start_time)) continue;
        if (mode === "slot") {
          if (!cfg.slotEnabled) continue;
          if (s.state.kind === "open_game") {
            const full = s.state.players_count >= s.state.max_players;
            arr.push({
              time: s.start_time,
              duration: s.duration,
              available: !full,
              unavailableReason: full ? "full" : undefined,
              slotPlayers: { count: s.state.players_count, max: s.state.max_players },
            });
          } else if (s.state.kind === "free") {
            arr.push({
              time: s.start_time,
              duration: s.duration,
              available: true,
              slotPlayers: { count: 0, max: cfg.maxPlayers },
            });
          } else {
            arr.push({
              time: s.start_time,
              duration: s.duration,
              available: false,
              unavailableReason: "booked",
            });
          }
        } else {
          const free = s.state.kind === "free";
          arr.push({
            time: s.start_time,
            duration: s.duration,
            available: free,
            unavailableReason: free ? undefined : "booked",
          });
        }
      }
      return arr;
    }

    // "All courts" — aggregate view (previous behavior)
    for (const a of availability.slot_availability) {
      const time = a.start_time;
      if (isPast(time)) continue;
      const slotDuration = a.duration;
      const slotGame = availability.slot_games.find(
        (g) => g.start_time.slice(0, 5) === time,
      );

      if (mode === "slot") {
        if (!cfg.slotEnabled) continue;
        if (slotGame) {
          const full = slotGame.players_count >= slotGame.max_players;
          arr.push({
            time,
            duration: slotDuration,
            available: !full,
            unavailableReason: full ? "full" : undefined,
            slotPlayers: { count: slotGame.players_count, max: slotGame.max_players },
          });
        } else {
          const free = a.free_courts > 0;
          arr.push({
            time,
            duration: slotDuration,
            available: free,
            unavailableReason: free ? undefined : "booked",
            slotPlayers: free ? { count: 0, max: cfg.maxPlayers } : undefined,
          });
        }
      } else {
        const free = !slotGame && a.free_courts > 0;
        arr.push({
          time,
          duration: slotDuration,
          available: free,
          unavailableReason: free ? undefined : "booked",
        });
      }
    }
    return arr;
  }, [availability, date, mode, cfg.maxPlayers, cfg.slotEnabled, selectedCourtId]);

  // Duration of the currently picked slot (or sport-fixed/default)
  const pickedSlot = slots.find((s) => s.time === startTime);
  const effectiveDuration =
    pickedSlot?.duration ?? (fixedDuration as DurationHours) ?? duration;
  const fullPrice = Number(venue.base_price_per_hour) * effectiveDuration;
  const perPersonPrice = Number((venue as any).slot_price ?? 0);

  const createFn = useServerFn(createBooking);
  const recurringFn = useServerFn(createRecurringBookings);
  const formatRecurringReason = (reason?: string) => {
    const normalized = normalizeRecurringReason(reason);
    if (normalized === "no_court") return t("booking.recurringReasonNoCourt");
    if (normalized === "past_slot") return t("booking.recurringReasonPastSlot");
    if (normalized === "user_overlap") return t("booking.recurringReasonUserOverlap");
    if (normalized === "slot_full") return t("booking.recurringReasonSlotFull");
    if (normalized === "venue_not_found") return t("booking.recurringReasonVenueNotFound");
    return reason?.trim() || t("booking.recurringReasonUnknown");
  };
  const mutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          venueId,
          date,
          startTime: startTime!,
          durationHours: effectiveDuration,
          mode,
          equipmentIds: Array.from(selectedEquip),
          ...(selectedCourtId ? { courtId: selectedCourtId } : {}),
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ["availability", venueId] });
      qc.invalidateQueries({ queryKey: ["open-games", "venue", venueId] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate({ to: "/bookings" });
    },
    onError: (e: Error) => setSubmitError(e.message),
  });

  const recurringMutation = useMutation({
    mutationFn: () =>
      recurringFn({
        data: {
          venueId,
          startDate: date,
          startTime: startTime!,
          weeks: recurWeeks,
          mode,
          courtId: selectedCourtId,
        },
      }),
    onSuccess: (r: any) => {
      if (!r?.ok) {
        setSubmitError(formatRecurringReason(r?.error));
        return;
      }
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ["availability", venueId] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });

      const failed = ((r.results ?? []) as { ok: boolean; error?: string }[]).filter((x) => !x.ok);
      const conflicts = failed.filter((x) => normalizeRecurringReason(x.error) === "no_court");
      const otherFailures = failed.filter((x) => normalizeRecurringReason(x.error) !== "no_court");
      const firstOtherReason = formatRecurringReason(otherFailures[0]?.error);

      if (r.created === 0) {
        const message = otherFailures.length > 0
          ? t("booking.recurringNoneCreatedReason", { reason: firstOtherReason })
          : t("booking.recurringNoneCreatedConflict");
        setSubmitError(message);
        toast.error(message);
        return;
      }

      if (otherFailures.length > 0) {
        toast.warning(t("booking.recurringCreatedWithFailures", {
          created: r.created,
          failed: otherFailures.length,
          reason: firstOtherReason,
        }));
      } else if (conflicts.length > 0) {
        toast.warning(t("booking.recurringCreatedWithConflicts", {
          created: r.created,
          skipped: conflicts.length,
        }));
      } else {
        toast.success(t("booking.recurringCreated", { created: r.created }));
      }
      navigate({ to: "/bookings" });
    },
    onError: (e: Error) => setSubmitError(e.message),
  });

  const submitting = mutation.isPending || recurringMutation.isPending;
  const priceMissing = mode === "slot" ? perPersonPrice <= 0 : fullPrice <= 0;
  const canSubmit = !!startTime && !submitting && !priceMissing;
  // keep sportMeta usage to avoid lint warnings
  void sportMeta;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-24">
      <Link
        to="/venues/$venueId"
        params={{ venueId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("booking.backToVenue")}
      </Link>

      <header className="mt-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${sportMeta.tokenClass}`}>
          {sportLabel}
        </span>

        <h1 className="mt-3 font-display text-3xl font-bold">{t("booking.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{venue.name} · {venue.area}</p>
      </header>

      <Section step={1} title={t("booking.type")} icon={Trophy}>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.slotEnabled && (
            <ModeOption
              active={mode === "slot"}
              onClick={() => setMode("slot")}
              title={t("booking.slotMode")}
              desc={t("booking.slotModeDesc", { n: cfg.maxPlayers })}
              badge={t("booking.popular")}
            />
          )}
          <ModeOption
            active={mode === "whole"}
            onClick={() => setMode("whole")}
            title={t("booking.wholeMode")}
            desc={t("booking.wholeModeDesc")}
          />
          {!cfg.slotEnabled && (
            <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              {t("booking.wholeOnly", { sport: sportLabel.toLowerCase() })}
            </div>
          )}
        </div>
      </Section>

      <Section step={2} title={t("booking.date")} icon={CalIcon}>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const active = d.iso === date;
            return (
              <button
                key={d.iso}
                onClick={() => { setDate(d.iso); setStartTime(null); }}
                className={`flex min-w-[84px] flex-col items-center rounded-2xl border px-3 py-2 transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.weekday}</span>
                <span className="font-display text-lg font-bold">{d.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section step={3} title={t("booking.duration")} icon={Clock}>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-sm font-semibold">
          {effectiveDuration}h
          <span className="text-xs font-normal text-muted-foreground">
            {pickedSlot
              ? `${pickedSlot.time}–${addHours(pickedSlot.time, pickedSlot.duration)}`
              : t("booking.pickTime")}
          </span>
        </div>
      </Section>

      <Section step={4} title={t("booking.time")} icon={Clock}>
        {availability && availability.court_availability.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setSelectedCourtId(null); setStartTime(null); }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                selectedCourtId === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              {t("booking.allCourts")}
            </button>
            {availability.court_availability.map((c) => (
              <button
                key={c.court_id}
                type="button"
                onClick={() => { setSelectedCourtId(c.court_id); setStartTime(null); }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  selectedCourtId === c.court_id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                {c.court_name}
              </button>
            ))}
          </div>
        )}
        {availLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("booking.loadingAvail")}
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            {t("booking.noSlots")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => {
              const active = s.time === startTime;
              const disabled = !s.available;
              return (
                <button
                  key={s.time}
                  onClick={() => setStartTime(s.time)}
                  disabled={disabled}
                  aria-disabled={disabled}
                  className={`flex flex-col items-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    disabled
                      ? "cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground opacity-60"
                      : active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <span>{s.time}</span>
                  {disabled ? (
                    <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      {s.unavailableReason === "full"
                        ? t("booking.slotFull")
                        : t("booking.slotBooked")}
                    </span>
                  ) : (
                    s.slotPlayers && (
                      <span
                        className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium ${
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        {s.slotPlayers.count}/{s.slotPlayers.max}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {equipment.length > 0 && (
        <Section step={5} title="Εξοπλισμός" icon={Sparkles}>
          <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
            <p className="text-sm font-semibold">
              Δεν έχεις εξοπλισμό; Με ένα κλικ σου τον παρέχουμε.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Η επιπλέον χρέωση είναι ακριβώς αυτή που όρισε ο ιδιοκτήτης.
            </p>
            <div className="mt-3 space-y-2">
              {equipment.map((e) => {
                const on = selectedEquip.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() =>
                      setSelectedEquip((prev) => {
                        const next = new Set(prev);
                        if (next.has(e.id)) next.delete(e.id);
                        else next.add(e.id);
                        return next;
                      })
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/60"
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      {e.name}
                    </span>
                    <span className="text-sm font-semibold">+€{e.price.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      <Section step={equipment.length > 0 ? 6 : 5} title="Επαναλαμβανόμενη κράτηση" icon={Repeat}>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 hover:border-primary/40">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          <div className="flex-1">
            <div className="text-sm font-semibold">Κάθε εβδομάδα, ίδια ώρα</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Δημιουργεί κρατήσεις για τις επόμενες εβδομάδες. Αν κάποιο slot είναι ήδη κρατημένο, παραλείπεται.
            </p>
            {recurring && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span>για</span>
                <input
                  type="number"
                  min={2}
                  max={26}
                  value={recurWeeks}
                  onChange={(e) =>
                    setRecurWeeks(Math.max(2, Math.min(26, Number(e.target.value) || 2)))
                  }
                  className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1 text-sm"
                />
                <span>εβδομάδες</span>
              </div>
            )}
          </div>
        </label>
      </Section>

      <div className="sticky bottom-4 mt-8 rounded-2xl border border-border/60 bg-card p-5 shadow-glow">
        {(() => {
          const basePrice = mode === "slot" ? perPersonPrice : fullPrice;
          const total = basePrice + equipmentTotal;
          const hasEquip = equipmentTotal > 0;
          return (
            <>
              {hasEquip && (
                <div className="mb-3 space-y-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {mode === "slot" ? "Τιμή θέσης" : "Τιμή γηπέδου"}
                    </span>
                    <span className="font-semibold">€{basePrice.toFixed(2)}</span>
                  </div>
                  {equipment
                    .filter((e) => selectedEquip.has(e.id))
                    .map((e) => (
                      <div key={e.id} className="flex items-center justify-between">
                        <span className="text-muted-foreground">+ {e.name}</span>
                        <span className="font-semibold">€{e.price.toFixed(2)}</span>
                      </div>
                    ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1">
                    <span className="font-semibold">Σύνολο</span>
                    <span className="font-bold">€{total.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {mode === "slot" ? t("booking.pricePerPerson") : t("booking.priceTotal")}
                  </div>
                  {priceMissing ? (
                    <div className="font-display text-lg font-semibold text-muted-foreground">
                      {t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
                    </div>
                  ) : (
                    <div className="font-display text-3xl font-bold">€{total.toFixed(2)}</div>
                  )}
                  {mode === "slot" && !priceMissing && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {t("booking.upTo", { n: cfg.maxPlayers })}
                    </div>
                  )}
                  {recurring && (
                    <div className="mt-1 text-xs text-muted-foreground">× {recurWeeks} εβδομάδες</div>
                  )}
                </div>
                <button
                  onClick={() => (recurring ? recurringMutation.mutate() : mutation.mutate())}
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {recurring ? `Κράτηση × ${recurWeeks}` : t("booking.confirm")}
                </button>
              </div>
            </>
          );
        })()}
        {submitError && (
          <p className="mt-3 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {submitError}
          </p>
        )}
        {!startTime && !submitError && (
          <p className="mt-3 text-xs text-muted-foreground">{t("booking.pickTime")}</p>
        )}
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {step}
        </span>
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ModeOption({
  active,
  onClick,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-2xl border p-4 text-left transition ${
        active
          ? "border-primary bg-primary/10"
          : "border-border/60 hover:border-primary/40"
      }`}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          {badge}
        </span>
      )}
      <div className="font-display text-base font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function toHour(t: string) {
  const [h, m] = t.split(":");
  return Number(h) + Number(m) / 60;
}

function addHours(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
