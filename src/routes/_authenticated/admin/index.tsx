import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { getPlatformStats } from "@/lib/api/admin.functions";
import { Building2, Calendar, Euro, UserCheck, Users, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminStats,
});

function AdminStats() {
  const { t } = useTranslation();
  const fetchStats = useServerFn(getPlatformStats);
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchStats() });
  const s = q.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={<Building2 className="h-5 w-5" />} label={t("admin.stats.venues")} value={s?.venues ?? "…"} />
        <Stat icon={<AlertCircle className="h-5 w-5" />} label={t("admin.stats.pendingVenues")} value={s?.pendingVenues ?? "…"} accent={s?.pendingVenues ? "text-amber-500" : undefined} />
        <Stat icon={<Calendar className="h-5 w-5" />} label={t("admin.stats.bookings30")} value={s?.bookings30 ?? "…"} />
        <Stat icon={<Euro className="h-5 w-5" />} label={t("admin.stats.revenue30")} value={s ? `${Math.round(s.revenue30)}€` : "…"} />
        <Stat icon={<Users className="h-5 w-5" />} label={t("admin.stats.players")} value={s?.players ?? "…"} />
        <Stat icon={<UserCheck className="h-5 w-5" />} label={t("admin.stats.owners")} value={s?.owners ?? "…"} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
