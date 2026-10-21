import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Check, ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Segmented } from "@/components/segmented";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useCampus } from "@/lib/campus";
import { courseKeys, listCourses, type Course } from "@/lib/courses";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/courses")({
  // ?d=<department> (default: yours)
  validateSearch: (s: Record<string, unknown>): { d?: string } =>
    typeof s.d === "string" && /^[a-z0-9_-]{2,40}$/.test(s.d) ? { d: s.d } : {},
  component: CoursesPage,
});

const fold = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
type Filter = "all" | "core" | "elective";

/** Every course of a department by semester; each opens its notes and past exam papers. */
function CoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMyProfile();
  const campus = useCampus();
  const { d } = Route.useSearch();
  const dep = d ?? me.data?.department_id ?? undefined;
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const courses = useQuery({ queryKey: courseKeys.list(dep ?? ""), queryFn: () => listCourses(dep!), enabled: !!dep });

  const sections = useMemo(() => {
    const f = fold(query.trim());
    const shown = (courses.data ?? []).filter(
      (c) =>
        (filter === "all" || (filter === "core" ? c.kind !== "elective" : c.kind === "elective")) &&
        (!f || fold(`${c.name} ${c.code ?? ""}`).includes(f)),
    );
    const by = new Map<number | null, Course[]>();
    for (const c of shown) by.set(c.semester, [...(by.get(c.semester) ?? []), c]);
    return [...by.entries()];
  }, [courses.data, query, filter]);

  return (
    <>
      <AppHeader back title={t("courses.title")} />
      <div className="space-y-3 px-4 pb-3">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-card px-4 py-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-fine text-muted-foreground">{campus.uniName(me.data?.university_id)}</span>
            <span className="line-clamp-2 block font-semibold leading-snug">{dep ? campus.depName(dep) : t("courses.pickDepartment")}</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
        {!!courses.data?.length && (
          <>
            <label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3 text-muted-foreground">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("courses.search")}
                className="min-w-0 flex-1 bg-transparent text-callout text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("courses.filter.all") },
                { value: "core", label: t("courses.filter.core") },
                { value: "elective", label: t("courses.filter.elective") },
              ]}
            />
          </>
        )}
      </div>

      {!dep && <EmptyState icon={BookOpen} text={t("courses.noDepartment")} />}
      {courses.data?.length === 0 && <EmptyState icon={BookOpen} title={t("courses.noCatalogTitle")} text={t("courses.noCatalog")} />}
      {!!courses.data?.length && !sections.length && <EmptyState text={t("courses.noMatch")} />}

      <div className="pb-28">
        {sections.map(([semester, list]) => (
          <section key={semester ?? "none"} className="mb-4">
            <h2 className="px-4 pb-1.5 text-callout font-semibold text-muted-foreground">
              {semester ? t("courses.semester", { n: semester }) : t("courses.anySemester")}
            </h2>
            <ul className="mx-4 divide-y divide-border overflow-hidden rounded-2xl bg-card">
              {list.map((c) => (
                <li key={c.id}>
                  <Link to="/c/$courseId" params={{ courseId: c.id }} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug">{c.name}</span>
                      <span className="block truncate text-fine text-muted-foreground">
                        {[c.code, t(`courses.kind.${c.kind}`), c.groups[0]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {c.files_count > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-caption font-semibold tabular-nums text-link">
                        <FileText className="h-4 w-4" /> {c.files_count}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <DepartmentSheet
        open={picking}
        university={me.data?.university_id}
        current={dep}
        onOpenChange={setPicking}
        onPick={(id) => {
          setPicking(false);
          setQuery("");
          void navigate({ to: "/courses", search: { d: id }, replace: true });
        }}
      />
    </>
  );
}

function DepartmentSheet({
  open,
  university,
  current,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  university?: string | null;
  current?: string;
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const campus = useCampus();
  const [query, setQuery] = useState("");
  const f = fold(query.trim());
  const list = campus.departments
    .filter((x) => x.university_id === university)
    .filter((x) => !f || [x.name_el, x.name_en, x.short_el, x.short_en].some((n) => fold(n).includes(f)));
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[85vh] max-w-lg">
        <DrawerTitle className="px-6 pt-4 text-center text-body font-semibold">{t("courses.pickDepartment")}</DrawerTitle>
        <DrawerDescription className="sr-only">{campus.uniName(university)}</DrawerDescription>
        <div className="safe-bottom overflow-y-auto px-4 pb-4 pt-3">
          <label className="mb-2 flex h-10 items-center gap-2 rounded-xl bg-secondary px-3 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("courses.searchDepartment")}
              className="min-w-0 flex-1 bg-transparent text-callout text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-group">
            {list.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => onPick(x.id)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left">
                  <span className="min-w-0 flex-1">{campus.depName(x.id)}</span>
                  <Check className={cn("h-5 w-5 shrink-0 text-link", x.id !== current && "invisible")} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
