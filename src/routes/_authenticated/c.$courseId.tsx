import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Image as ImageIcon, MoreHorizontal, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
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
  uploadCourseFile,
  type CourseFile,
  type FileKind,
} from "@/lib/courses";
import { rpcErrorKey } from "@/lib/friends";
import { timeAgoShort } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/c/$courseId")({
  component: CoursePage,
});

/** One course: its notes and past exam papers, uploaded by the students of the university. */
function CoursePage() {
  const { courseId } = Route.useParams();
  const { t } = useTranslation();
  const campus = useCampus();
  const course = useQuery({ queryKey: courseKeys.one(courseId), queryFn: () => getCourse(courseId) });
  const files = useQuery({ queryKey: courseKeys.files(courseId), queryFn: () => listCourseFiles(courseId), enabled: !!course.data });
  const [tab, setTab] = useState<FileKind>("notes");
  const [uploading, setUploading] = useState(false);
  const c = course.data;
  const count = (k: FileKind) => (files.data ?? []).filter((f) => f.kind === k).length;
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
            <button
              type="button"
              onClick={() => setUploading(true)}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground"
            >
              <Upload className="h-5 w-5" /> {t("courses.upload")}
            </button>
          </section>
          <Segmented
            className="mx-4 mb-2"
            value={tab}
            onChange={setTab}
            options={[
              { value: "notes", label: `${t("courses.notes")}${count("notes") ? ` · ${count("notes")}` : ""}` },
              { value: "exams", label: `${t("courses.exams")}${count("exams") ? ` · ${count("exams")}` : ""}` },
            ]}
          />
          {files.data && !shown.length && <EmptyState text={t(tab === "notes" ? "courses.noNotes" : "courses.noExams")} />}
          <ul className="divide-y divide-border pb-28">
            {shown.map((f) => (
              <FileRow key={f.id} file={f} />
            ))}
          </ul>
          <UploadSheet courseId={c.id} open={uploading} kind={tab} onOpenChange={setUploading} onDone={setTab} />
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
  const Icon = f.mime === "application/pdf" ? FileText : ImageIcon;
  return (
    <li className="flex items-center gap-1 pl-4 pr-1">
      <a href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5">
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
        </span>
      </a>
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
