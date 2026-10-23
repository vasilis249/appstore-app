import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Download, FileText, HandHeart, Image as ImageIcon, MessageCircleQuestion, MoreHorizontal, Paperclip, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { supabase } from "@/integrations/supabase/client";
import { Segmented } from "@/components/segmented";
import { PersonActionsSheet } from "@/components/friends/person-actions-sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useTapConfirm } from "@/hooks/use-tap-confirm";
import { useCampus } from "@/lib/campus";
import {
  courseKeys,
  deleteCourseFile,
  FILE_ACCEPT,
  FILE_MAX_BYTES,
  formatSize,
  getCourse,
  listCourseFiles,
  myCourses,
  recordDownload,
  setTaking,
  thankFile,
  uploadCourseFile,
  type CourseFile,
  type FileKind,
} from "@/lib/courses";
import { rpcErrorKey } from "@/lib/friends";
import { haptic } from "@/lib/haptics";
import { enablePush } from "@/lib/push";
import { timeAgoShort } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

type Tab = FileKind | "questions";
export const Route = createFileRoute("/_authenticated/c/$courseId")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    s.tab === "exams" || s.tab === "questions" ? { tab: s.tab } : {},
  component: CoursePage,
});

/**
 * One course: its notes and past exam papers, uploaded by the students of the university, and its questions (campus
 * posts in «Ερωτήσεις» tied to the course; answers are their replies).
 */
function CoursePage() {
  const { courseId } = Route.useParams();
  const { t } = useTranslation();
  const campus = useCampus();
  const course = useQuery({ queryKey: courseKeys.one(courseId), queryFn: () => getCourse(courseId) });
  const files = useQuery({ queryKey: courseKeys.files(courseId), queryFn: () => listCourseFiles(courseId), enabled: !!course.data });
  const [tab, setTab] = useState<Tab>(Route.useSearch().tab ?? "notes");
  const questions = useQuery({
    queryKey: [...courseKeys.one(courseId), "questions"],
    enabled: !!course.data,
    queryFn: async () =>
      (await supabase.from("posts").select("id", { count: "exact", head: true }).eq("course_id", courseId).is("reply_to", null).is("deleted_at", null)).count ?? 0,
  });
  const [uploading, setUploading] = useState(false);
  const c = course.data;
  const count = (k: Tab) => (k === "questions" ? (questions.data ?? 0) : (files.data ?? []).filter((f) => f.kind === k).length);
  const shown = (files.data ?? []).filter((f) => f.kind === tab);

  return (
    <>
      <AppHeader back title={t("courses.course")} />
      {course.data === null && <EmptyState text={t("rpcErrors.notFound")} />}
      {c && (
        <>
          <section className="px-4 pb-4">
            <p className="text-fine text-muted-foreground">{campus.depName(c.department_id)}</p>
            <h1 className="mt-1 text-display font-semibold leading-tight">{c.name}</h1>
            <p className="mt-1 text-caption text-muted-foreground">
              {[c.code, c.semester ? t("courses.semester", { n: c.semester }) : null, t(`courses.kind.${c.kind}`), ...c.groups]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {c.takers_count > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-caption font-semibold text-link">
                <Users className="h-4 w-4" /> {t("courses.takers", { count: c.takers_count })}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              {tab === "questions" ? (
                <Link
                  to="/record"
                  search={{ course: c.id }}
                  className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground"
                >
                  <MessageCircleQuestion className="h-5 w-5" /> {t("courses.ask")}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setUploading(true)}
                  className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground"
                >
                  <Upload className="h-5 w-5" /> {t("courses.upload")}
                </button>
              )}
              <TakingButton courseId={c.id} />
            </div>
          </section>
          <Segmented
            className="mx-4 mb-2"
            value={tab}
            onChange={setTab}
            options={[
              { value: "notes", label: `${t("courses.notes")}${count("notes") ? ` · ${count("notes")}` : ""}` },
              { value: "exams", label: `${t("courses.exams")}${count("exams") ? ` · ${count("exams")}` : ""}` },
              { value: "questions", label: `${t("courses.questions")}${count("questions") ? ` · ${count("questions")}` : ""}` },
            ]}
          />
          {tab === "questions" ? (
            <div className="pb-28">
              <FeedList params={{ scope: "course", course: c.id }} playAll={false} empty={<EmptyState text={t("courses.noQuestions")} />} />
            </div>
          ) : (
            <>
              {files.data && !shown.length && <EmptyState text={t(tab === "notes" ? "courses.noNotes" : "courses.noExams")} />}
              <ul className="divide-y divide-border pb-28">
                {shown.map((f) => (
                  <FileRow key={f.id} file={f} />
                ))}
              </ul>
            </>
          )}
          <UploadSheet courseId={c.id} open={uploading} kind={tab === "questions" ? "notes" : tab} onOpenChange={setUploading} onDone={setTab} />
        </>
      )}
    </>
  );
}

function FileRow({ file: f }: { file: CourseFile }) {
  const { t, i18n } = useTranslation();
  const me = useMyProfile().data?.id;
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const confirm = useTapConfirm();
  const mine = !!me && f.uploader?.id === me;
  const remove = useMutation({
    mutationFn: () => deleteCourseFile(f),
    onSuccess: () => void qc.invalidateQueries({ queryKey: courseKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const [thanked, setThanked] = useState(f.thanked);
  const [thanks, setThanks] = useState(f.thanks_count);
  const thank = useMutation({
    mutationFn: (on: boolean) => thankFile(f.id, on),
    onMutate: (on) => {
      haptic("light");
      setThanked(on);
      setThanks((n) => n + (on ? 1 : -1));
    },
    onSuccess: (n) => setThanks(n),
    onError: (e, on) => {
      setThanked(!on);
      setThanks(f.thanks_count);
      toast.error(t(rpcErrorKey(e)));
    },
  });
  const Icon = f.mime === "application/pdf" ? FileText : ImageIcon;
  return (
    <li className="flex items-center gap-1 pl-4 pr-1">
      <a
        href={f.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => !mine && recordDownload(f.id)}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-link">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">{f.title}</span>
          <span className="block truncate text-fine text-muted-foreground">
            {[f.uploader?.full_name || f.uploader?.username, timeAgoShort(f.created_at, i18n.language), formatSize(f.size_bytes, i18n.language)]
              .filter(Boolean)
              .join(" · ")}
            {f.hidden && ` · ${t("courses.hiddenFile")}`}
          </span>
          {(f.downloads_count > 0 || (mine && thanks > 0)) && (
            <span className="mt-0.5 flex items-center gap-2.5 text-fine text-muted-foreground">
              {f.downloads_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" /> {t("courses.downloads", { count: f.downloads_count })}
                </span>
              )}
              {mine && thanks > 0 && (
                <span className="inline-flex items-center gap-1 text-live">
                  <HandHeart className="h-3.5 w-3.5" /> {t("courses.thanks", { count: thanks })}
                </span>
              )}
            </span>
          )}
        </span>
      </a>
      {!mine && (
        <button
          type="button"
          aria-pressed={thanked}
          aria-label={t(thanked ? "courses.thanked" : "courses.thank")}
          onClick={() => thank.mutate(!thanked)}
          className={cn("hit flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-caption font-semibold tabular-nums", thanked ? "text-live" : "text-muted-foreground")}
        >
          <HandHeart className={cn("h-5 w-5", thanked && "animate-like-pop")} fill={thanked ? "currentColor" : "none"} />
          {thanks > 0 && thanks}
        </button>
      )}
      {mine ? (
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => confirm.tap(() => remove.mutate())}
          className={cn("hit h-9 shrink-0 rounded-full px-3 text-caption font-semibold", confirm.isArmed() ? "bg-destructive text-destructive-foreground" : "text-muted-foreground")}
        >
          {t(confirm.isArmed() ? "courses.confirmDelete" : "courses.delete")}
        </button>
      ) : (
        <button type="button" aria-label={t("friends.actions")} onClick={() => setMenu(true)} className="hit grid h-10 w-10 shrink-0 place-items-center text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      )}
      {f.uploader && !mine && (
        <PersonActionsSheet
          person={menu ? f.uploader : null}
          report={{ kind: "course_file", id: f.id, label: t("courses.reportFile") }}
          onOpenChange={setMenu}
          onBlocked={() => void qc.invalidateQueries({ queryKey: courseKeys.all })}
        />
      )}
    </li>
  );
}

/** «Το δίνω»: you'll hear about every new file here; asks for push the first time. */
function TakingButton({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: courseKeys.mine, queryFn: myCourses });
  const on = !!mine.data?.some((c) => c.id === courseId);
  const toggle = useMutation({
    mutationFn: () => setTaking(courseId, !on),
    onMutate: () => haptic("medium"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: courseKeys.all });
      if (!on) {
        toast.success(t("courses.takingToast"));
        void enablePush(true);
      }
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!mine.data || toggle.isPending}
      onClick={() => toggle.mutate()}
      className={cn(
        "flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 font-semibold disabled:opacity-60",
        on ? "bg-link/10 text-link" : "bg-secondary text-foreground",
      )}
    >
      {on && <Check className="h-4 w-4" strokeWidth={3} />}
      {t("courses.taking")}
    </button>
  );
}

function UploadSheet({
  courseId,
  open,
  kind: initialKind,
  onOpenChange,
  onDone,
}: {
  courseId: string;
  open: boolean;
  kind: FileKind;
  onOpenChange: (open: boolean) => void;
  onDone: (kind: FileKind) => void;
}) {
  const { t, i18n } = useTranslation();
  const me = useMyProfile().data?.id;
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>(initialKind);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const reset = (o: boolean) => {
    if (o) setKind(initialKind);
    else {
      setTitle("");
      setFile(null);
    }
    onOpenChange(o);
  };
  const send = useMutation({
    mutationFn: () => uploadCourseFile(me!, courseId, kind, title, file!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success(t("courses.uploaded"));
      void enablePush(true); // a good moment: they'll want to hear who downloaded / thanked
      onDone(kind);
      reset(false);
    },
    onError: (e) => toast.error(t(e instanceof Error && e.message === "file_too_big" ? "courses.tooBig" : rpcErrorKey(e))),
  });
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!FILE_ACCEPT.split(",").includes(f.type)) return void toast.error(t("courses.badType"));
    if (f.type === "application/pdf" && f.size > FILE_MAX_BYTES) return void toast.error(t("courses.tooBig"));
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  };
  return (
    <Drawer open={open} onOpenChange={reset}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg">
        <DrawerTitle className="px-6 pt-4 text-center text-body font-semibold">{t("courses.upload")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("courses.uploadHint")}</DrawerDescription>
        <form
          className="safe-bottom space-y-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (file && title.trim()) send.mutate();
          }}
        >
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "notes", label: t("courses.notes") },
              { value: "exams", label: t("courses.exams") },
            ]}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            aria-label={t("courses.fileTitle")}
            placeholder={t(kind === "notes" ? "courses.notesPlaceholder" : "courses.examsPlaceholder")}
            className="h-12 w-full rounded-xl bg-secondary px-3.5 text-body outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-left"
          >
            <Paperclip className="h-5 w-5 shrink-0 text-link" />
            <span className="min-w-0 flex-1 truncate">
              {file ? `${file.name} · ${formatSize(file.size, i18n.language)}` : t("courses.chooseFile")}
            </span>
          </button>
          <input ref={input} type="file" accept={FILE_ACCEPT} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <p className="text-fine text-muted-foreground">{t("courses.uploadHint")}</p>
          <button
            type="submit"
            disabled={!file || !title.trim() || send.isPending}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t(send.isPending ? "courses.uploading" : "courses.send")}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
