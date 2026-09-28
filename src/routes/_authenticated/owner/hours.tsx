import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Wand2 } from "lucide-react";

import {
  listCourtSlots,
  addCourtSlot,
  deleteCourtSlot,
  bulkGenerateCourtSlots,
  listCourtClosures,
  addCourtClosure,
  deleteCourtClosure,
  type CourtSlot,
  type CourtClosure,
} from "@/lib/api/owner-management.functions";
import { listOwnerVenues } from "@/lib/api/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/owner/hours")({
  head: () => ({ meta: [{ title: "Ωρολόγιο Πρόγραμμα — Courtsie" }] }),
  component: SchedulePage,
});

function SchedulePage() {
  const { t } = useTranslation();
  const DAYS = t("days.long", { returnObjects: true }) as string[];
  const qc = useQueryClient();
  const [venueId, setVenueId] = useState<string | null>(null);

  const venuesQ = useQuery({
    queryKey: ["owner-venues"],
    queryFn: () => listOwnerVenues(),
  });
  useEffect(() => {
    if (!venueId && venuesQ.data?.[0]) setVenueId(venuesQ.data[0].id);
  }, [venuesQ.data, venueId]);

  const slotsQ = useQuery({
    queryKey: ["court-slots", venueId],
    queryFn: () => listCourtSlots({ data: { venueId: venueId! } }),
    enabled: !!venueId,
  });

  const [courtId, setCourtId] = useState<string | null>(null);
  const [day, setDay] = useState<number>(1);

  useEffect(() => {
    if (!courtId && slotsQ.data?.courts[0]) setCourtId(slotsQ.data.courts[0].id);
  }, [slotsQ.data, courtId]);

  const currentSlots = useMemo(() => {
    if (!slotsQ.data || !courtId) return [] as CourtSlot[];
    return slotsQ.data.slots
      .filter((s) => s.court_id === courtId && s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slotsQ.data, courtId, day]);

  const sport = slotsQ.data?.courts.find((c) => c.id === courtId)?.sport ?? "padel";
  const defaultSlotMinutes = sport === "padel" ? 90 : 60;

  const addFn = useServerFn(addCourtSlot);
  const delFn = useServerFn(deleteCourtSlot);
  const bulkFn = useServerFn(bulkGenerateCourtSlots);

  const addMut = useMutation({
    mutationFn: (vars: { startTime: string; endTime: string }) =>
      addFn({
        data: {
          courtId: courtId!,
          dayOfWeek: day,
          startTime: vars.startTime,
          endTime: vars.endTime,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-slots", venueId] });
    },
    onError: (e: any) => toast.error(e.message ?? t("ownerHours.error")),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["court-slots", venueId] }),
  });

  const bulkMut = useMutation({
    mutationFn: (vars: { open: string; close: string; minutes: number; replace: boolean }) =>
      bulkFn({
        data: {
          courtId: courtId!,
          dayOfWeek: day,
          openTime: vars.open,
          closeTime: vars.close,
          slotMinutes: vars.minutes,
          replace: vars.replace,
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["court-slots", venueId] });
      toast.success(t("ownerHours.generated", { count: r.count }));
    },
    onError: (e: any) => toast.error(e.message ?? t("ownerHours.error")),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("ownerHours.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("ownerHours.subtitle")}</p>
        </div>
        {venuesQ.data && (
          <select
            value={venueId ?? ""}
            onChange={(e) => {
              setVenueId(e.target.value);
              setCourtId(null);
            }}
            className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
          >
            {venuesQ.data.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {!slotsQ.data ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {t("ownerHours.loading")}
        </div>
      ) : slotsQ.data.courts.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {t("ownerHours.noCourts")}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Court + day pickers */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap gap-2">
              {slotsQ.data.courts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCourtId(c.id)}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                    c.id === courtId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDay(i)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    i === day ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {courtId && (
            <>
              <BulkGenerator
                defaultMinutes={defaultSlotMinutes}
                onGenerate={(vars) => bulkMut.mutate(vars)}
                pending={bulkMut.isPending}
              />

              <ManualAddForm
                defaultMinutes={defaultSlotMinutes}
                onAdd={(vars) => addMut.mutate(vars)}
                pending={addMut.isPending}
              />

              {/* Slot list for selected court+day */}
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <h3 className="mb-3 font-semibold">{t("ownerHours.slotsFor", { day: DAYS[day] })}</h3>
                {currentSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("ownerHours.noSlots")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentSlots.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-3 py-1.5 text-sm"
                      >
                        <span className="font-mono font-semibold">
                          {s.start_time}–{s.end_time}
                        </span>
                        <button
                          onClick={() => delMut.mutate(s.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={t("ownerHours.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {venueId && <ClosuresSection venueId={venueId} />}
    </div>
  );
}

function BulkGenerator({
  defaultMinutes,
  onGenerate,
  pending,
}: {
  defaultMinutes: number;
  onGenerate: (v: { open: string; close: string; minutes: number; replace: boolean }) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState("08:00");
  const [close, setClose] = useState("23:00");
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [replace, setReplace] = useState(true);

  useEffect(() => setMinutes(defaultMinutes), [defaultMinutes]);

  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-4">
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <Wand2 className="h-4 w-4 text-primary" /> {t("ownerHours.bulkTitle")}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="text-xs">
          <span className="text-muted-foreground">{t("ownerHours.from")}</span>
          <Input type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">{t("ownerHours.to")}</span>
          <Input type="time" value={close} onChange={(e) => setClose(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">{t("ownerHours.slotMinutes")}</span>
          <Input
            type="number"
            min={15}
            max={240}
            step={15}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <label className="flex items-end gap-1 text-xs">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          <span>{t("ownerHours.replaceExisting")}</span>
        </label>
        <Button onClick={() => onGenerate({ open, close, minutes, replace })} disabled={pending} size="sm">
          {t("ownerHours.generate")}
        </Button>
      </div>
    </div>
  );
}

function ManualAddForm({
  defaultMinutes,
  onAdd,
  pending,
}: {
  defaultMinutes: number;
  onAdd: (v: { startTime: string; endTime: string }) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState(() => addMinutes("18:00", defaultMinutes));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="mb-2 font-semibold">{t("ownerHours.addTitle")}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="text-muted-foreground">{t("ownerHours.start")}</span>
          <Input
            type="time"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setEnd(addMinutes(e.target.value, defaultMinutes));
            }}
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">{t("ownerHours.end")}</span>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <Button onClick={() => onAdd({ startTime: start, endTime: end })} disabled={pending || end <= start} size="sm">
          <Plus className="mr-1 h-4 w-4" /> {t("ownerHours.add")}
        </Button>
      </div>
    </div>
  );
}

function addMinutes(t: string, minutes: number) {
  const [h, m] = t.split(":").map(Number);
  const tot = h * 60 + m + minutes;
  const hh = Math.floor(tot / 60) % 24;
  const mm = tot % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ----------------- Closures (override specific dates/weekdays) -------- */

function ClosuresSection({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const DAYS = t("days.long", { returnObjects: true }) as string[];
  const closuresQ = useQuery({
    queryKey: ["court-closures", venueId],
    queryFn: () => listCourtClosures({ data: { venueId } }),
  });

  const addFn = useServerFn(addCourtClosure);
  const delFn = useServerFn(deleteCourtClosure);

  const [form, setForm] = useState({
    courtId: "" as string,
    kind: "date" as "date" | "weekday",
    date: new Date().toISOString().slice(0, 10),
    weekday: 1,
    startTime: "18:00",
    endTime: "19:30",
    reason: "",
  });

  useEffect(() => {
    if (!form.courtId && closuresQ.data?.courts[0]) {
      setForm((f) => ({ ...f, courtId: closuresQ.data!.courts[0].id }));
    }
  }, [closuresQ.data, form.courtId]);

  const addMut = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          courtId: form.courtId,
          date: form.kind === "date" ? form.date : null,
          weekday: form.kind === "weekday" ? form.weekday : null,
          startTime: form.startTime,
          endTime: form.endTime,
          reason: form.reason || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-closures", venueId] });
      toast.success(t("ownerHours.added"));
      setForm((f) => ({ ...f, reason: "" }));
    },
    onError: (e: any) => toast.error(e.message ?? t("ownerHours.error")),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["court-closures", venueId] }),
  });

  const courtName = (id: string) => closuresQ.data?.courts.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
      <h2 className="mb-1 font-display text-lg font-semibold">{t("ownerHours.closuresTitle")}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{t("ownerHours.closuresDesc")}</p>

      {closuresQ.data?.courts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ownerHours.noCourts")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <select
              value={form.courtId}
              onChange={(e) => setForm((f) => ({ ...f, courtId: e.target.value }))}
              className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
            >
              {closuresQ.data?.courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as any }))}
              className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
            >
              <option value="date">{t("ownerHours.closureKindDate")}</option>
              <option value="weekday">{t("ownerHours.closureKindWeekday")}</option>
            </select>
            {form.kind === "date" ? (
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            ) : (
              <select
                value={form.weekday}
                onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
                className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
            <Input
              placeholder={t("ownerHours.reasonPh")}
              value={form.reason}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={() => addMut.mutate()} disabled={addMut.isPending || !form.courtId}>
              <Plus className="mr-1 h-4 w-4" /> {t("ownerHours.add")}
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            {(closuresQ.data?.closures ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("ownerHours.noClosures")}</p>
            ) : (
              (closuresQ.data?.closures ?? []).map((c: CourtClosure) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border/40 bg-surface px-3 py-2 text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {courtName(c.court_id)} · {c.date ? c.date : t("ownerHours.every", { day: DAYS[c.weekday ?? 0] })}{" "}
                      · {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}
                    </div>
                    {c.reason && <div className="text-xs text-muted-foreground">{c.reason}</div>}
                  </div>
                  <button
                    onClick={() => delMut.mutate(c.id)}
                    className="rounded-md border border-border/60 p-1 text-muted-foreground hover:text-destructive"
                    aria-label={t("ownerHours.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
