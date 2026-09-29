// Continuous playback for public voice posts (a queue, like a podcast): one shared <audio>
// element, auto-advance, lock-screen controls via the Media Session API. The iOS app keeps
// playing in the background (UIBackgroundModes audio). Private clips (DMs, memories) use
// `player` from audio.ts; starting one stops the other.
import { useSyncExternalStore } from "react";
import { player, setExclusiveHandler } from "@/lib/audio";
import { recordListen } from "@/lib/posts";

export interface QueueItem {
  /** The post that owns the audio (for a repost: the original). */
  id: string;
  url: string;
  durationMs: number;
  title: string;
  author: string;
}

interface QueueState {
  items: QueueItem[];
  index: number;
  playing: boolean;
  progress: number; // 0..1 of the current item
}

let state: QueueState = { items: [], index: -1, playing: false, progress: 0 };
const listeners = new Set<() => void>();
const counted = new Set<string>();
let el: HTMLAudioElement | null = null;
let raf = 0;

function set(patch: Partial<QueueState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function audio(): HTMLAudioElement {
  if (el) return el;
  el = new Audio();
  el.setAttribute("playsinline", "");
  el.preload = "auto";
  el.onended = () => next();
  el.onpause = () => set({ playing: false });
  el.onplay = () => set({ playing: true });
  return el;
}

function tick() {
  const a = audio();
  const item = state.items[state.index];
  const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : (item?.durationMs ?? 0) / 1000;
  if (total > 0) set({ progress: Math.min(1, a.currentTime / total) });
  raf = requestAnimationFrame(tick);
}

function mediaSession(item: QueueItem) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: item.author, album: "Speak" });
    navigator.mediaSession.setActionHandler("play", () => resume());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  } catch {
    /* not supported */
  }
}

function start(index: number) {
  const item = state.items[index];
  if (!item) return stop();
  const a = audio();
  cancelAnimationFrame(raf);
  a.src = item.url;
  set({ index, progress: 0 });
  mediaSession(item);
  void a.play().catch(() => set({ playing: false }));
  raf = requestAnimationFrame(tick);
  if (!counted.has(item.id)) {
    counted.add(item.id);
    void recordListen(item.id);
  }
}

/** Call from a tap: plays `items` starting at `index`, then continues through the list. */
export function playQueue(items: QueueItem[], index = 0) {
  player.stop();
  set({ items });
  start(index);
}

export function pause() {
  audio().pause();
}
export function resume() {
  player.stop();
  void audio().play().catch(() => {});
}
export function toggle() {
  if (state.playing) pause();
  else if (state.index >= 0) resume();
}
export function next() {
  if (state.index + 1 < state.items.length) start(state.index + 1);
  else stop();
}
export function prev() {
  const a = audio();
  if (a.currentTime > 3 || state.index <= 0) a.currentTime = 0;
  else start(state.index - 1);
}
export function seek(fraction: number) {
  const a = audio();
  if (Number.isFinite(a.duration)) a.currentTime = fraction * a.duration;
}
export function stop() {
  cancelAnimationFrame(raf);
  if (el) {
    el.pause();
    el.removeAttribute("src");
  }
  set({ items: [], index: -1, playing: false, progress: 0 });
}

// A DM / memory clip starting stops the queue.
setExclusiveHandler(() => {
  if (state.index >= 0) pause();
});

export function useQueue(): QueueState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function currentId(s: QueueState): string | null {
  return s.items[s.index]?.id ?? null;
}
