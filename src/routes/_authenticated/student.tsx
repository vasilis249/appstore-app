import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Check, GraduationCap, Search } from "lucide-react";
import { BigInput, FieldNote, StepShell } from "@/components/auth/step-shell";
import { useMyProfile } from "@/hooks/use-my-profile";
import { sendStudentCode } from "@/lib/api/student.functions";
import { clearStudentIdentity, setStudentInfo, useCampus, verifyStudentCode, yearOptions } from "@/lib/campus";
import { friendKeys, rpcErrorKey } from "@/lib/friends";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/student")({
  validateSearch: (s: Record<string, unknown>): { welcome?: 1 } => ({ welcome: s.welcome ? 1 : undefined }),
  component: StudentPage,
});

type Step = "manage" | "email" | "code" | "school" | "year";

/**
 * Student identity, one question per screen: academic email (any open university) → 6-digit code → department → year.
 * `?welcome=1` right after sign-up (with "Skip"); from Settings it opens on what you have, with change / remove.
 */
function StudentPage() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMyProfile();
  const campus = useCampus();
  const send = useServerFn(sendStudentCode);
  const verified = !!me.data?.university_id;

  const [step, setStep] = useState<Step | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [school, setSchool] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (step || !me.data) return;
    setSchool(me.data.department_id ?? null);
    setYear(me.data.study_year ?? null);
    setStep(verified ? (me.data.department_id ? "manage" : "school") : "email");
  }, [me.data, step, verified]);

  const leave = () => void navigate({ to: search.welcome ? "/" : "/profile", replace: true });
  const refresh = () => qc.invalidateQueries({ queryKey: ["profile"] }).then(() => qc.invalidateQueries({ queryKey: friendKeys.all }));
  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  async function sendCode() {
    setError(null);
    setLoading(true);
    try {
      await send({ data: { email, lang: i18n.language.startsWith("en") ? "en" : "el" } });
      setCode("");
      go("code");
    } catch (e) {
      setError(t(rpcErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }

  async function checkCode() {
    setError(null);
    setLoading(true);
    try {
      const r = await verifyStudentCode(code);
      if (r === "ok") {
        await refresh();
        go("school");
      } else setError(t(`student.codeErrors.${r}`));
    } catch (e) {
      setError(t(rpcErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }

  async function saveInfo() {
    setLoading(true);
    try {
      // A year the new department doesn't have (e.g. 6th after switching away from Medicine) is dropped.
      await setStudentInfo(school, year && yearOptions(campus.dep(school)?.years).includes(year) ? year : null);
      await refresh();
      leave();
    } catch (e) {
      setError(t(rpcErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirmRemove) return setConfirmRemove(true);
    setLoading(true);
    try {
      await clearStudentIdentity();
      await refresh();
      leave();
    } finally {
      setLoading(false);
    }
  }

  const skip = search.welcome ? (
    <button type="button" onClick={leave} className="text-body font-normal">
      {t("auth.skip")}
    </button>
  ) : undefined;
  const en = i18n.language.startsWith("en");
  const uniId = me.data?.university_id;
  const schools = campus.departments.filter((d) => d.university_id === uniId);
  // Big universities (ΕΚΠΑ has 42 departments) get a search box; accents and case don't matter.
  const fold = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const shown = query.trim()
    ? schools.filter((d) => [d.short_el, d.name_el, d.short_en, d.name_en].some((x) => fold(x).includes(fold(query.trim()))))
    : schools;
  const detected = campus.uniForEmail(email);
  const accepted = campus.universities.filter((u) => u.open).map((u) => (en ? u.short_en : u.short_el)).join(" · ");

  if (!step) return null;

  if (step === "manage")
    return (
      <StepShell
        onBack={leave}
        title={t("student.manageTitle")}
        subtitle={t("student.manageHint")}
        action={t("student.change")}
        onSubmit={() => go("school")}
        above={
          <button
            type="button"
            disabled={loading}
            onClick={() => void remove()}
            className={cn("mb-2 h-12 w-full rounded-full text-callout font-semibold", confirmRemove ? "bg-destructive text-destructive-foreground" : "text-destructive")}
          >
            {confirmRemove ? t("student.removeConfirm") : t("student.remove")}
          </button>
        }
      >
        <div className="flex items-center gap-4 rounded-2xl bg-card p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{campus.uniName(me.data?.university_id)}</p>
            <p className="text-caption text-muted-foreground">
              {[campus.depName(me.data?.department_id), me.data?.study_year ? t(`student.years.${me.data.study_year}`) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </StepShell>
    );

  if (step === "email")
    return (
      <StepShell
        onBack={search.welcome ? undefined : leave}
        right={skip}
        title={t("student.emailTitle")}
        subtitle={t("student.emailHint")}
        action={t("student.sendCode")}
        disabled={!/^\S+@\S+\.\S+$/.test(email)}
        loading={loading}
        onSubmit={() => void sendCode()}
      >
        <BigInput
          type="email"
          inputMode="email"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="…@uoa.gr"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
        />
        {error ? (
          <FieldNote error>{error}</FieldNote>
        ) : detected ? (
          <FieldNote>
            <span className="font-semibold text-foreground">{t("student.detected", { uni: en ? detected.name_en : detected.name_el })}</span>
          </FieldNote>
        ) : (
          <FieldNote>{t("student.emailPrivacy")}</FieldNote>
        )}
        {accepted && <p className="mt-4 text-caption leading-snug text-muted-foreground">{t("student.supported", { list: accepted })}</p>}
      </StepShell>
    );

  if (step === "code")
    return (
      <StepShell
        onBack={() => go("email")}
        right={skip}
        title={t("student.codeTitle")}
        subtitle={t("student.codeHint", { email })}
        action={t("student.verify")}
        disabled={!/^\d{6}$/.test(code)}
        loading={loading}
        onSubmit={() => void checkCode()}
      >
        <BigInput
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          className="tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error && <FieldNote error>{error}</FieldNote>}
        <button type="button" disabled={loading} onClick={() => void sendCode()} className="mt-5 text-callout font-semibold text-link">
          {t("student.resend")}
        </button>
      </StepShell>
    );

  if (step === "school")
    return (
      <StepShell
        onBack={verified && me.data?.department_id ? () => go("manage") : undefined}
        right={skip}
        title={t("student.schoolTitle")}
        subtitle={campus.uniName(uniId)}
        action={t("auth.continue")}
        disabled={!school}
        onSubmit={() => go("year")}
      >
        {schools.length > 12 && (
          <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-secondary px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("student.searchSchool")}
              autoCapitalize="none"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent text-callout outline-none placeholder:text-muted-foreground"
            />
          </label>
        )}
        <ul className="-mx-1 space-y-1">
          {shown.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSchool(d.id)}
                aria-pressed={school === d.id}
                className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left", school === d.id ? "bg-secondary" : "active:bg-secondary/60")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{en ? d.short_en : d.short_el}</span>
                  <span className="block text-caption leading-snug text-muted-foreground">{en ? d.name_en : d.name_el}</span>
                </span>
                {school === d.id && <Check className="h-5 w-5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
        {/* Not listed: stay a verified student of the university, without a department (and its groups). */}
        <button
          type="button"
          onClick={() => {
            setSchool(null);
            go("year");
          }}
          className="mt-3 text-callout font-semibold text-link"
        >
          {t("student.noSchool")}
        </button>
      </StepShell>
    );

  return (
    <StepShell
      onBack={() => go("school")}
      right={skip}
      title={t("student.yearTitle")}
      subtitle={t("student.yearHint")}
      action={t("student.done")}
      loading={loading}
      onSubmit={() => void saveInfo()}
    >
      <div className="flex flex-wrap gap-2">
        {yearOptions(campus.dep(school)?.years).map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(year === y ? null : y)}
            aria-pressed={year === y}
            className={cn("h-11 rounded-full px-5 text-callout font-semibold", year === y ? "bg-primary text-primary-foreground" : "bg-secondary")}
          >
            {t(`student.years.${y}`)}
          </button>
        ))}
      </div>
      {error && <FieldNote error>{error}</FieldNote>}
    </StepShell>
  );
}
