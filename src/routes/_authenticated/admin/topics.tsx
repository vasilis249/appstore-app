import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Pin, PinOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Switch } from "@/components/ui/switch";
import { useSections } from "@/hooks/use-sections";
import { useCampus } from "@/lib/campus";
import {
  adminFeeds, adminKeys, adminTopics, amIAdmin, campusModerators, createTopic, refreshNews, setCampusModerator, setCampusThreshold,
  setFeed, updateTopic,
} from "@/lib/admin";
import { campusStatus, campusStatusKeys } from "@/lib/campus";
import { UserAvatar } from "@/components/user-avatar";
import { dailyKeys, getToday } from "@/lib/daily";
import { rpcErrorKey } from "@/lib/friends";
import { toMoment } from "@/lib/memories";
import { postKeys } from "@/lib/posts";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/topics")({
  component: AdminTopicsPage,
});

/** Admin: create topics (or the topic of the day), news sources, hide / pin topics. */
function AdminTopicsPage() {
  const { t } = useTranslation();
  const isAdmin = useQuery({ queryKey: adminKeys.isAdmin, queryFn: amIAdmin });
  if (isAdmin.data === false) return <Navigate to="/" replace />;
  return (
    <>
      <AppHeader back title={t("admin.title")} />
      {isAdmin.data && (
        <div className="space-y-8 px-4 pb-10 pt-2">
          <NewTopic />
          <CampusAdmin />
          <Feeds />
          <Topics />
        </div>
      )}
    </>
  );
}

function useRefreshAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: adminKeys.topics });
    void qc.invalidateQueries({ queryKey: adminKeys.feeds });
    void qc.invalidateQueries({ queryKey: postKeys.all });
    void qc.invalidateQueries({ queryKey: dailyKeys.all });
  };
}

function NewTopic() {
  const { t } = useTranslation();
  const { sections, campusSections, name } = useSections();
  const campus = useCampus();
  const openUni = campus.universities.find((u) => u.open);
  const today = useQuery({ queryKey: dailyKeys.today, queryFn: getToday });
  const refresh = useRefreshAll();
  const [section, setSection] = useState("news");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [daily, setDaily] = useState(false);
  const [date, setDate] = useState("");
  // A topic for one campus (its students only) uses the student sections.
  const [campusOnly, setCampusOnly] = useState(false);
  const pickable = campusOnly ? campusSections : sections;
  const sectionOk = pickable.some((s) => s.id === section);
  // Default day: today's moment if you haven't picked its topic yet, otherwise the next one.
  const nextDay = today.data
    ? today.data.topic_is_pick
      ? toMoment(new Date(today.data.next_prompt_at))
      : today.data.moment
    : "";

  const create = useMutation({
    mutationFn: () =>
      createTopic({
        section,
        title: title.trim(),
        sourceUrl: url.trim(),
        dailyDate: daily ? date || nextDay : undefined,
        university: campusOnly ? openUni?.id : undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setDaily(false);
      toast.success(t("admin.created"));
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error && e.message.includes("daily_date") ? t("admin.dailyTaken") : t(rpcErrorKey(e))),
  });
  const input = "h-12 w-full rounded-2xl bg-secondary px-4 text-base outline-none placeholder:text-muted-foreground";
  const valid = sectionOk && title.trim().length >= 3 && (!url.trim() || /^https?:\/\//.test(url.trim()));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.newTopic")}</h2>
      {openUni && (
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium">
          <span>{t("admin.campusOnly", { uni: campus.uni(openUni.id)?.short_el })}</span>
          <Switch
            checked={campusOnly}
            onCheckedChange={(on) => {
              setCampusOnly(on);
              setSection(on ? "courses" : "news");
            }}
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {pickable.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn("h-8 rounded-full px-3 text-sm font-semibold", section === s.id ? "bg-primary text-primary-foreground" : "bg-secondary")}
          >
            {name(s.id)}
          </button>
        ))}
      </div>
      <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder={t("admin.titlePlaceholder")} className={input} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("admin.linkPlaceholder")} inputMode="url" className={input} />
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium">
        <span>{t("admin.asDaily")}</span>
        <Switch checked={daily} onCheckedChange={setDaily} />
      </label>
      {daily && (
        <input type="date" value={date || nextDay} onChange={(e) => setDate(e.target.value)} className={input} aria-label={t("admin.date")} />
      )}
      <button
        type="button"
        disabled={!valid || create.isPending}
        onClick={() => create.mutate()}
        className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40"
      >
        {t("admin.create")}
      </button>
    </section>
  );
}

/** The open campus (ΕΜΠ): students needed before it opens (0 = open), and its student moderators. */
function CampusAdmin() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const campus = useCampus();
  const uni = campus.universities.find((u) => u.open);
  const status = useQuery({ queryKey: campusStatusKeys.status, queryFn: campusStatus });
  const mods = useQuery({ queryKey: adminKeys.moderators(uni?.id ?? ""), queryFn: () => campusModerators(uni!.id), enabled: !!uni });
  const [min, setMin] = useState("");
  const [username, setUsername] = useState("");
  const input = "h-12 w-full rounded-2xl bg-secondary px-4 text-base outline-none placeholder:text-muted-foreground";
  const saveMin = useMutation({
    mutationFn: () => setCampusThreshold(uni!.id, Number(min) || 0),
    onSuccess: () => {
      setMin("");
      toast.success(t("admin.saved"));
      void qc.invalidateQueries({ queryKey: campusStatusKeys.status });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const mod = useMutation({
    mutationFn: ({ name, on }: { name: string; on: boolean }) => setCampusModerator(name, uni!.id, on),
    onSuccess: () => {
      setUsername("");
      void qc.invalidateQueries({ queryKey: adminKeys.moderators(uni!.id) });
    },
    onError: (e) => toast.error(e instanceof Error && e.message.includes("not_student") ? t("admin.notStudent") : t(rpcErrorKey(e))),
  });
  if (!uni) return null;
  const short = campus.label({ university_id: uni.id });
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.campusTitle", { uni: short })}</h2>
      <p className="text-sm text-muted-foreground">
        {status.data
          ? t("admin.campusNow", { students: status.data.students, min: status.data.min_students })
          : t("admin.campusNotStudent")}
      </p>
      <div className="flex gap-2">
        <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={t("admin.minStudents")} className={input} />
        <button type="button" disabled={!min || saveMin.isPending} onClick={() => saveMin.mutate()} className="h-12 shrink-0 rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-40">
          {t("admin.save")}
        </button>
      </div>
      <p className="pt-2 text-sm font-semibold">{t("admin.moderators")}</p>
      <ul className="divide-y divide-border rounded-2xl bg-secondary">
        {(mods.data ?? []).map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
            <UserAvatar name={m.full_name || m.username} path={m.avatar_path} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">@{m.username}</span>
            <button type="button" onClick={() => mod.mutate({ name: m.username, on: false })} className="text-sm font-semibold text-destructive">
              {t("admin.remove")}
            </button>
          </li>
        ))}
        {mods.data && !mods.data.length && <li className="px-4 py-3 text-sm text-muted-foreground">{t("admin.noModerators")}</li>}
      </ul>
      <div className="flex gap-2">
        <input value={username} onChange={(e) => setUsername(e.target.value.trim())} placeholder="@username" autoCapitalize="none" className={input} />
        <button type="button" disabled={username.length < 3 || mod.isPending} onClick={() => mod.mutate({ name: username, on: true })} className="h-12 shrink-0 rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-40">
          {t("admin.add")}
        </button>
      </div>
    </section>
  );
}

function Feeds() {
  const { t, i18n } = useTranslation();
  const { name } = useSections();
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const feeds = useQuery({ queryKey: adminKeys.feeds, queryFn: adminFeeds });
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => setFeed(id, on),
    onSettled: () => qc.invalidateQueries({ queryKey: adminKeys.feeds }),
  });
  const run = useMutation({
    mutationFn: refreshNews,
    onSuccess: (n) => {
      toast.success(t("admin.refreshed", { count: n }));
      refresh();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.feeds")}</h2>
        <button type="button" disabled={run.isPending} onClick={() => run.mutate()} className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-4 text-sm font-semibold disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", run.isPending && "animate-spin")} /> {t("admin.refresh")}
        </button>
      </div>
      <ul className="divide-y divide-border rounded-2xl bg-secondary">
        {(feeds.data ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {f.name} <span className="font-normal text-muted-foreground">· {name(f.section_id)}</span>
              </p>
              <p className={cn("truncate text-xs", f.last_error ? "text-destructive" : "text-muted-foreground")}>
                {f.last_error ??
                  (f.last_fetched_at ? `${timeAgo(f.last_fetched_at, i18n.language)} · +${f.last_added ?? 0}` : t("admin.never"))}
              </p>
            </div>
            <Switch checked={f.enabled} onCheckedChange={(on) => toggle.mutate({ id: f.id, on })} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Topics() {
  const { t, i18n } = useTranslation();
  const { name } = useSections();
  const campus = useCampus();
  const refresh = useRefreshAll();
  const topics = useQuery({ queryKey: adminKeys.topics, queryFn: adminTopics });
  const upd = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { hidden?: boolean; pinned?: boolean } }) => updateTopic(id, patch),
    onSettled: refresh,
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const badge = (tp: { kind: string; daily_date: string | null }) =>
    tp.kind === "daily" && tp.daily_date
      ? t("admin.dailyOn", { date: new Date(`${tp.daily_date}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "short" }) })
      : t(`admin.kind.${tp.kind}`);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.topics")}</h2>
      <ul className="divide-y divide-border rounded-2xl bg-secondary">
        {(topics.data ?? []).map((tp) => (
          <li key={tp.id} className={cn("flex items-start gap-2 px-4 py-3", tp.hidden && "opacity-50")}>
            <Link to="/t/$topicId" params={{ topicId: tp.id }} className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className={cn("font-semibold", tp.kind === "daily" && "text-coral")}>{badge(tp)}</span> · {name(tp.section_id)}
                {tp.university_id && <span className="font-semibold text-foreground"> · {campus.label({ university_id: tp.university_id })}</span>}
                {tp.source_name && ` · ${tp.source_name}`} · {timeAgo(tp.created_at, i18n.language)} · {t("posts.voicesCount", { count: tp.posts_count })}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug">{tp.title}</p>
            </Link>
            <button type="button" aria-label={tp.pinned ? t("admin.unpin") : t("admin.pin")} onClick={() => upd.mutate({ id: tp.id, patch: { pinned: !tp.pinned } })} className={cn("grid h-9 w-9 place-items-center rounded-full", tp.pinned && "text-coral")}>
              {tp.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            <button type="button" aria-label={tp.hidden ? t("admin.show") : t("admin.hide")} onClick={() => upd.mutate({ id: tp.id, patch: { hidden: !tp.hidden } })} className="grid h-9 w-9 place-items-center rounded-full">
              {tp.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
