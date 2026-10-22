// Courses of a department (catalog, read-only) and the notes / past exam papers students upload per course.
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image";

export interface Course {
  id: string;
  department_id: string;
  code: string | null;
  name: string;
  /** null = no fixed semester (e.g. free electives) */
  semester: number | null;
  kind: "core" | "track_core" | "elective";
  groups: string[];
  files_count: number;
  /** students who marked «Το δίνω» */
  takers_count: number;
}
export type FileKind = "notes" | "exams";
export interface CourseFile {
  id: string;
  course_id: string;
  kind: FileKind;
  title: string;
  path: string;
  mime: string;
  size_bytes: number;
  hidden: boolean;
  created_at: string;
  downloads_count: number;
  thanks_count: number;
  /** I said «Ευχαριστώ» */
  thanked: boolean;
  uploader: { id: string; username: string; full_name: string; avatar_path: string | null } | null;
  /** Signed URL (1 h) to open the file. */
  url: string | null;
}

export const FILE_MAX_BYTES = 20 * 1024 * 1024;
export const FILE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export const courseKeys = {
  all: ["courses"] as const,
  list: (dep: string) => ["courses", "list", dep] as const,
  one: (id: string) => ["courses", "one", id] as const,
  files: (id: string) => ["courses", "files", id] as const,
  mine: ["courses", "mine"] as const,
  helpers: (dep: string) => ["courses", "helpers", dep] as const,
  stats: (user: string) => ["courses", "stats", user] as const,
};

const COLS = "id, department_id, code, name, semester, kind, groups, files_count, takers_count";

export async function listCourses(department: string): Promise<Course[]> {
  const { data, error } = await supabase.from("courses").select(COLS).eq("department_id", department)
    .order("semester", { nullsFirst: false }).order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as Course[];
}

export async function getCourse(id: string): Promise<Course | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from("courses").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Course | null;
}

export async function listCourseFiles(course: string): Promise<CourseFile[]> {
  const { data, error } = await supabase.from("course_files")
    .select("id, course_id, kind, title, path, mime, size_bytes, hidden, created_at, downloads_count, thanks_count, uploader:profiles!course_files_uploader_id_fkey(id, username, full_name, avatar_path)")
    .eq("course_id", course).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as CourseFile[];
  if (rows.length) {
    const [signed, thanks] = await Promise.all([
      supabase.storage.from("course-files").createSignedUrls(rows.map((f) => f.path), 3600),
      supabase.from("course_file_thanks").select("file_id").in("file_id", rows.map((f) => f.id)),
    ]);
    const url = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
    const thanked = new Set((thanks.data ?? []).map((x) => x.file_id));
    for (const f of rows) {
      f.url = url.get(f.path) ?? null;
      f.thanked = thanked.has(f.id);
    }
  }
  return rows;
}

/** PDFs go up as they are, photos are resized first; the stored file is removed again if adding it fails. */
export async function uploadCourseFile(me: string, course: string, kind: FileKind, title: string, file: File) {
  const pdf = file.type === "application/pdf";
  const body: Blob = pdf ? file : await compressImage(file, 2400, 0.85);
  if (body.size > FILE_MAX_BYTES) throw new Error("file_too_big");
  const path = `${me}/${crypto.randomUUID()}.${pdf ? "pdf" : body.type === "image/png" ? "png" : "jpg"}`;
  const bucket = supabase.storage.from("course-files");
  const up = await bucket.upload(path, body, { contentType: pdf ? "application/pdf" : body.type || "image/jpeg", upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.rpc("add_course_file", { p_course: course, p_kind: kind, p_title: title.trim(), p_path: path });
  if (error) {
    await bucket.remove([path]);
    throw new Error(error.message);
  }
}

export async function deleteCourseFile(f: CourseFile) {
  const { error } = await supabase.rpc("delete_course_file", { p_file: f.id });
  if (error) throw new Error(error.message);
  await supabase.storage.from("course-files").remove([f.path]); // a leftover is removed by the sweeper
}

/** Opening a classmate's file counts once per person (the server ignores your own). */
export function recordDownload(file: string) {
  // the query builder only runs once it is awaited / then-ed
  void supabase.rpc("record_course_download", { p_file: file }).then(() => {});
}

/** «Ευχαριστώ» on / off → the file's thanks count. */
export async function thankFile(file: string, on: boolean): Promise<number> {
  const { data, error } = await supabase.rpc("thank_course_file", { p_file: file, p_on: on });
  if (error) throw new Error(error.message);
  return data as number;
}

/** «Το δίνω» on / off → how many take the course. */
export async function setTaking(course: string, on: boolean): Promise<number> {
  const { data, error } = await supabase.rpc("set_taking_course", { p_course: course, p_on: on });
  if (error) throw new Error(error.message);
  return data as number;
}

/** The courses I marked «Το δίνω», newest first. */
export async function myCourses(): Promise<Course[]> {
  const { data, error } = await supabase.from("course_takers").select(`course:courses(${COLS})`).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { course: Course | null }[]).flatMap((r) => (r.course ? [r.course] : []));
}

export interface Helper {
  user_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  study_year: number | null;
  points: number;
  files: number;
  downloads: number;
  thanks: number;
  rank: number;
}
export async function topHelpers(department: string, limit = 5): Promise<Helper[]> {
  const { data, error } = await supabase.rpc("top_helpers", { p_department: department, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as Helper[];
}

export interface HelperStats {
  points: number;
  files: number;
  downloads: number;
  thanks: number;
  rank: number | null;
  founding: boolean;
  top: boolean;
}
/** Points, place in the department and badges; null for students of another university. */
export async function helperStats(user: string): Promise<HelperStats | null> {
  const { data, error } = await supabase.rpc("helper_stats", { p_user: user });
  if (error) throw new Error(error.message);
  return ((data ?? []) as HelperStats[])[0] ?? null;
}

/** "2,1 MB" / "640 KB" */
export function formatSize(bytes: number, lang: string): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1
    ? `${mb.toLocaleString(lang, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
