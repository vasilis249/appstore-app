import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarCheck, Euro, TrendingUp } from "lucide-react";
import {
  differenceInCalendarDays,
  format,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

import { Switch } from "@/components/ui/switch";
import { getOwnerReports } from "@/lib/api/owner-management.functions";
import { listOwnerVenues } from "@/lib/api/owner.functions";

export const Route = createFileRoute("/_authenticated/owner/reports")({
  head: () => ({ meta: [{ title: "Αναφορές — Courtsie" }] }),
  component: ReportsPage,
});

type Mode = "day" | "month" | "custom";

function ReportsPage() {
  const { t, i18n } = useTranslation();
  const todayIso = format(new Date(), "yyyy-MM-dd");

  const [venueId, setVenueId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("day");
  const [customFrom, setCustomFrom] = useState(
    format(subDays(new Date(), 29), "yyyy-MM-dd"),
  );
  const [customTo, setCustomTo] = useState(todayIso);
  const [showChannelSplit, setShowChannelSplit] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const venuesQ = useQuery({
    queryKey: ["owner-venues"],
    queryFn: () => listOwnerVenues(),
  });
  useEffect(() => {
    if (!venueId && venuesQ.data?.[0]) setVenueId(venuesQ.data[0].id);
  }, [venuesQ.data, venueId]);

  const { from, to, granularity } = useMemo(() => {
    if (mode === "day") {
      return {
        from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
        to: todayIso,
        granularity: "day" as const,
      };
    }
    if (mode === "month") {
      return {
        from: format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd"),
        to: todayIso,
        granularity: "month" as const,
      };
    }
    const a = customFrom <= customTo ? customFrom : customTo;
    const b = customFrom <= customTo ? customTo : customFrom;
    const span = differenceInCalendarDays(
      new Date(`${b}T00:00:00`),
      new Date(`${a}T00:00:00`),
    );
    return {
      from: a,
      to: b,
      granularity: (span <= 92 ? "day" : "month") as "day" | "month",
    };
  }, [mode, customFrom, customTo, todayIso]);

  const reportsQ = useQuery({
    queryKey: ["owner-reports", venueId, from, to, granularity, showCompare],
    queryFn: () =>
      getOwnerReports({
        data: { venueId: venueId!, from, to, granularity, compare: showCompare },
      }),
    enabled: !!venueId,
  });

  const r = reportsQ.data;
  const loc = i18n.language === "el" ? "el-GR" : i18n.language;

  const chartData = useMemo(() => {
    if (!r) return [];
    return r.buckets.map((b) => ({
      ...b,
      label:
        r.granularity === "day"
          ? new Date(`${b.key}T00:00:00`).toLocaleDateString(loc, {
              day: "2-digit",
              month: "2-digit",
            })
          : new Date(`${b.key}-01T00:00:00`).toLocaleDateString(loc, {
              month: "short",
              year: "numeric",
            }),
    }));
  }, [r, loc]);

  const pct = (cur: number, prev?: number) =>
    prev !== undefined && prev > 0
      ? Math.round(((cur - prev) / prev) * 100)
      : null;

  const avg = r && r.totals.bookings > 0 ? r.totals.revenue / r.totals.bookings : 0;
  const prevAvg =
    r && r.totals.prevRevenue !== undefined && (r.totals.prevBookings ?? 0) > 0
      ? r.totals.prevRevenue / (r.totals.prevBookings as number)
      : undefined;

  const multiSeries = showChannelSplit || showCompare;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("reports.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("reports.subtitle")}
          </p>
        </div>
        {venuesQ.data && (
          <select
            value={venueId ?? ""}
            onChange={(e) => setVenueId(e.target.value)}
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

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="inline-flex rounded-xl border border-border/60 bg-card p-1">
          {(["day", "month", "custom"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "day"
                ? t("reports.modeDay")
                : m === "month"
                  ? t("reports.modeMonth")
                  : t("reports.modeCustom")}
            </button>
          ))}
        </div>

        {mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-muted-foreground">{t("reports.from")}</label>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
            />
            <label className="text-muted-foreground">{t("reports.to")}</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayIso}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
            />
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={showChannelSplit}
            onCheckedChange={setShowChannelSplit}
          />
          {t("reports.channelSplit")}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={showCompare} onCheckedChange={setShowCompare} />
          {t("reports.comparePrev")}
        </label>
      </div>

      {!r ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {t("reports.loading")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              icon={Euro}
              label={t("reports.revenuePeriod")}
              value={`€${r.totals.revenue.toLocaleString(loc)}`}
              delta={showCompare ? pct(r.totals.revenue, r.totals.prevRevenue) : null}
            />
            <Stat
              icon={CalendarCheck}
              label={t("reports.bookingsPeriod")}
              value={String(r.totals.bookings)}
              delta={
                showCompare ? pct(r.totals.bookings, r.totals.prevBookings) : null
              }
            />
            <Stat
              icon={TrendingUp}
              label={t("reports.avgBasket")}
              value={`€${avg.toFixed(2)}`}
              delta={showCompare && prevAvg !== undefined ? pct(avg, prevAvg) : null}
            />
          </div>

          <Card
            title={
              r.granularity === "day"
                ? t("reports.revenueByDay")
                : t("reports.revenueByMonth")
            }
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={0} barCategoryGap="18%">
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  {multiSeries && <Legend />}
                  {!showChannelSplit && showCompare && (
                    <Bar
                      dataKey="prevRevenue"
                      name={t("reports.previous")}
                      fill="#9ca3af"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {!showChannelSplit && (
                    <Bar
                      dataKey="revenue"
                      name={t("reports.current")}
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {showChannelSplit && showCompare && (
                    <Bar
                      dataKey="prevOnlineRevenue"
                      name={`${t("reports.online")} — ${t("reports.previous")}`}
                      fill="#c7d2fe"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {showChannelSplit && (
                    <Bar
                      dataKey="onlineRevenue"
                      name={t("reports.online")}
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {showChannelSplit && showCompare && (
                    <Bar
                      dataKey="prevPhoneRevenue"
                      name={`${t("reports.phone")} — ${t("reports.previous")}`}
                      fill="#bae6fd"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {showChannelSplit && (
                    <Bar
                      dataKey="phoneRevenue"
                      name={t("reports.phone")}
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t("reports.popularHours")}>
              <div className="h-64">
                {r.popularHours.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("reports.noData")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.popularHours} layout="vertical">
                      <CartesianGrid
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        dataKey="hour"
                        type="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={50}
                      />
                      <Bar dataKey="count" fill="#c8ff4d" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title={t("reports.mix")}>
              <div className="h-64">
                {r.totals.bookings === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("reports.noData")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={0} barCategoryGap="18%">
                      <CartesianGrid
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Legend />
                      <Bar
                        dataKey="onlineCount"
                        name={t("reports.online")}
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="phoneCount"
                        name={t("reports.phone")}
                        fill="#38bdf8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: any;
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {delta !== null && delta !== undefined && (
        <div
          className={`mt-1 text-xs font-medium ${
            delta >= 0 ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
