import { useCallback, useEffect, useRef, useState } from "react";
import { pickRecorderMime } from "@/lib/audio";

export type RecorderState = "idle" | "recording" | "recorded";

/** Microphone recorder with a hard time limit (auto-stops at `maxMs`). */
export function useRecorder(maxMs: number) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; mime: string; durationMs: number } | null>(null);
  const [error, setError] = useState<"denied" | "unsupported" | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const discardNext = useRef(false);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const mime = pickRecorderMime();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      setError("denied");
      return;
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream.current, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64000 });
    rec.current = r;
    discardNext.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const durationMs = Math.min(maxMs, Date.now() - startedAt.current);
      cleanup();
      if (discardNext.current || !chunks.length) {
        setState("idle");
        return;
      }
      const type = (r.mimeType || mime || "audio/mp4").split(";")[0];
      setClip({ blob: new Blob(chunks, { type }), mime: type, durationMs });
      setState("recorded");
    };
    startedAt.current = Date.now();
    setElapsedMs(0);
    r.start(250);
    setState("recording");
    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsedMs(ms);
      if (ms >= maxMs) stop();
    }, 100);
  }, [cleanup, maxMs, stop]);

  /** Cancel a recording in progress, or throw away the recorded clip. */
  const discard = useCallback(() => {
    if (state === "recording") {
      discardNext.current = true;
      stop();
    }
    setClip(null);
    setElapsedMs(0);
    setState("idle");
  }, [state, stop]);

  useEffect(
    () => () => {
      discardNext.current = true;
      if (rec.current && rec.current.state !== "inactive") rec.current.stop();
      cleanup();
    },
    [cleanup],
  );

  return { state, elapsedMs, clip, error, start, stop, discard };
}
