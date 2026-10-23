import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useMyProfile } from "@/hooks/use-my-profile";
import { courseKeys, listCourses, myCourses, setTaking, type Course } from "@/lib/courses";
import { rpcErrorKey } from "@/lib/friends";
import { enablePush } from "@/lib/push";
import { cn } from "@/lib/utils";

const HIDE_KEY = "courtsie:pickCoursesHidden";

/** The semester a student of `year` (1–6) is in now: Feb–Aug = the spring (even) one, else the winter (odd) one. */
function currentSemester(year: number, now = new Date()) {
  const m = now.getMonth();
  return m >= 1 && m <= 7 ? year * 2 : year * 2 - 1;
}

/**
 * First useful action on Campus: "which courses do you have this semester?" — this semester's courses of your
 * department, the core ones ticked. Saving marks them «Το δίνω», so new notes / past papers there reach you.
 * Shown until you take any course (or tap «Όχι τώρα»).
 */
export function PickCoursesCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useMyProfile().data;
  const dep = me?.department_id;
  const year = me?.study_year && me.study_year <= 6 ? me.study_year : null;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const mine = useQuery({
    queryKey: courseKeys.mine,
    queryFn: myCourses,
    enabled: !!dep && !!year && !hidden,
  });
  const list = useQuery({
    queryKey: courseKeys.list(dep ?? ""),
    queryFn: () => listCourses(dep!),
    enabled: !!dep && !!year && !hidden,
  });
  const sem = year ? currentSemester(year) : 0;
  const now: Course[] = (list.data ?? [])
    .filter((c) => c.semester === sem)
    .sort((a, b) => Number(a.kind !== "core") - Number(b.kind !== "core"));
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = picked ?? new Set(now.filter((c) => c.kind === "core").map((c) => c.id));
  const save = useMutation({
    mutationFn: async () => {
      for (const id of chosen) await setTaking(id, true); // ≤ 20 per student, the server says so
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success(t("courses.pickedToast", { count: chosen.size }));
      void enablePush(true); // the moment it is useful: new files in these courses
    },
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: courseKeys.all }); // the ones saved before the error count
      toast.error(t(rpcErrorKey(e)));
    },
  });
  if (hidden || !year || !mine.data || mine.data.length > 0 || !now.length) return null;
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };
  const later = () => {
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* private mode: hidden for this visit only */
    }
    setHidden(true);
  };
  return (
    <section className="mx-4 mb-3 rounded-2xl bg-card p-4" aria-labelledby="pick-courses">
      <h2 id="pick-courses" className="font-semibold leading-snug">
        {t("courses.pickTitle", { n: sem })}
      </h2>
      <p className="mt-0.5 text-caption text-muted-foreground">{t("courses.pickText")}</p>
      <ul className="-mx-1 mt-3 space-y-0.5">
        {now.map((c) => {
          const on = chosen.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left active:bg-secondary/60"
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on && <Check className="h-4 w-4" strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-callout leading-snug">{c.name}</span>
                  {c.kind !== "core" && (
                    <span className="block text-fine text-muted-foreground">
                      {t(`courses.kind.${c.kind}`)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!chosen.size || save.isPending}
          onClick={() => save.mutate()}
          className="h-11 flex-1 rounded-full bg-primary text-callout font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("courses.pickSave", { count: chosen.size })}
        </button>
        <button
          type="button"
          onClick={later}
          className="h-11 px-4 text-callout font-semibold text-muted-foreground"
        >
          {t("courses.pickLater")}
        </button>
      </div>
    </section>
  );
}
