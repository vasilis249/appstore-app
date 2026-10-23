import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, CircleCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import {
  adminKeys,
  adminMetrics,
  adminMetricsOverview,
  metricsKeys,
  myStaffRole,
  type CampusMetrics,
} from "@/lib/admin";
import { useCampus } from "@/lib/campus";

export const Route = createFileRoute("/_authenticated/admin/metrics")({
  validateSearch: (s: Record<string, unknown>): { u?: string } =>
    typeof s.u === "string" && /^[a-z0-9-]{2,40}$/.test(s.u) ? { u: s.u } : {},
  component: MetricsPage,
});

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

/**
 * Admins only: how each campus is doing, from data Speak already stores (no tracking, no people — counts and rates).
 * List of universities → one university's numbers and its departments (with the O4 readiness proposal, read-only).
 */
function MetricsPage() {
  const { t } = useTranslation();
  const { u } = Route.useSearch();
  const campus = useCampus();
  const staff = useQuery({ queryKey: adminKeys.staff, queryFn: myStaffRole });
  const admin = !!staff.data?.is_admin;
  const overview = useQuery({
    queryKey: metricsKeys.one(null),
    queryFn: adminMetricsOverview,
    enabled: admin && !u,
  });
  const one = useQuery({
    queryKey: metricsKeys.one(u ?? ""),
    queryFn: () => adminMetrics(u!),
    enabled: admin && !!u,
  });
  if (staff.data && !admin) return <Navigate to="/" replace />;

  return (
    <>
      <AppHeader back title={u ? campus.uniName(u) || u : t("metrics.title")} />
      {!u && (
        <>
          <p className="px-4 pb-3 text-caption text-muted-foreground">{t("metrics.hint")}</p>
          {overview.data && !overview.data.length && <EmptyState text={t("metrics.none")} />}
          <ul className="mx-4 divide-y divide-border rounded-2xl bg-card">
            {(overview.data ?? []).map((r) => (
              <li key={r.university_id}>
                <Link
                  to="/admin/metrics"
                  search={{ u: r.university_id }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">
                      {campus.uniName(r.university_id) || r.university_id}
                    </span>
                    <span className="block text-caption tabular-nums text-muted-foreground">
                      {t("metrics.row", {
                        students: r.students,
                        fresh: r.new_7d,
                        active: r.active_7d,
                        contributors: r.contributors_30d,
                        files: r.files,
                        questions: r.questions,
                      })}
                    </span>
                    <span className="block text-fine text-muted-foreground">
                      {r.students >= r.min_students
                        ? t("metrics.open")
                        : t("metrics.waiting", { n: r.students, min: r.min_students })}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {u && one.data && <CampusNumbers m={one.data} />}
      <p className="px-4 pb-28 pt-4 text-fine leading-snug text-muted-foreground">
        {t("metrics.definitions")}
      </p>
    </>
  );
}

function CampusNumbers({ m }: { m: CampusMetrics }) {
  const { t } = useTranslation();
  const campus = useCampus();
  const tiles: { label: string; value: string | number; sub?: string }[] = [
    {
      label: t("metrics.students"),
      value: m.students,
      sub: t("metrics.fresh", { week: m.new_7d, month: m.new_30d }),
    },
    { label: t("metrics.referred"), value: m.referred_30d, sub: t("metrics.last30") },
    { label: t("metrics.active"), value: m.active_7d, sub: pct(m.active_7d, m.students) },
    { label: t("metrics.contributors"), value: m.contributors_30d, sub: t("metrics.last30") },
    {
      label: t("metrics.activation"),
      value: pct(m.activation.activated, m.activation.cohort),
      sub: t("metrics.ofCohort", { n: m.activation.activated, of: m.activation.cohort }),
    },
    {
      label: t("metrics.week1"),
      value: pct(m.week1.kept, m.week1.cohort),
      sub: t("metrics.ofCohort", { n: m.week1.kept, of: m.week1.cohort }),
    },
    {
      label: t("metrics.taking"),
      value: m.courses_taken_by,
      sub: pct(m.courses_taken_by, m.students),
    },
    {
      label: t("metrics.files"),
      value: m.files_30d,
      sub: t("metrics.filesSub", { downloads: m.downloads_30d, thanks: m.thanks_30d }),
    },
    {
      label: t("metrics.questions"),
      value: m.questions_30d,
      sub: t("metrics.questionsSub", {
        answered: pct(m.questions_answered, m.questions_30d),
        helpful: m.questions_helpful,
      }),
    },
    {
      label: t("metrics.firstAnswer"),
      value: m.first_answer_hours ?? "—",
      sub: t("metrics.hours"),
    },
    { label: t("metrics.posts"), value: m.posts_30d, sub: t("metrics.last30") },
    {
      label: t("metrics.reports"),
      value: m.reports_30d,
      sub: t("metrics.reportsSub", { open: m.reports_open, hours: m.report_hours ?? "—" }),
    },
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 px-4">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl bg-card p-3.5">
            <dt className="text-caption text-muted-foreground">{x.label}</dt>
            <dd className="mt-1 text-display font-semibold leading-none tabular-nums">{x.value}</dd>
            {x.sub && (
              <dd className="mt-1.5 text-fine leading-snug text-muted-foreground">{x.sub}</dd>
            )}
          </div>
        ))}
      </dl>
      <h2 className="px-4 pb-2 pt-6 text-callout font-semibold text-muted-foreground">
        {t("metrics.departments")}
      </h2>
      <ul className="mx-4 divide-y divide-border rounded-2xl bg-card">
        {m.departments.map((d) => (
          <li key={d.department_id ?? "none"} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-callout font-semibold">
                {d.department_id ? campus.depName(d.department_id) : t("metrics.noDepartment")}
              </span>
              <span className="block text-caption tabular-nums text-muted-foreground">
                {t("metrics.depRow", {
                  students: d.students,
                  active: d.active_7d,
                  contributors: d.contributors_30d,
                  resources: d.resources_30d,
                })}
              </span>
            </span>
            {d.ready ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-caption font-semibold">
                <CircleCheck className="h-4 w-4 text-success" /> {t("metrics.ready")}
              </span>
            ) : (
              <span className="shrink-0 text-caption text-muted-foreground">
                {t("metrics.notReady")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="px-4 pt-2 text-fine leading-snug text-muted-foreground">
        {t("metrics.readyNote")}
      </p>
    </>
  );
}
