import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/native";
import { sendPosition } from "./api";

/**
 * Keeps the server's copy of your position fresh while sharing is on.
 * In the iOS app: @capacitor-community/background-geolocation (Always permission → updates keep coming with the
 * app closed; iOS shows the blue location indicator). On the web: watchPosition, only while the page is open.
 * Sent at most every 10 s, sooner if you moved more than 20 m, and at least once a minute while updates arrive.
 *
 * Separately, the map shows where you are right now straight from the device (`watchLocal`), whether you share or
 * not; that position never leaves the phone unless sharing is on.
 */

interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  bearing: number | null;
  speed: number | null;
}
interface BgError {
  code?: string;
  message: string;
}
interface BackgroundGeolocationPlugin {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (position?: BgLocation, error?: BgError) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type TrackerStatus = "idle" | "running" | "denied" | "unavailable";

let status: TrackerStatus = "idle";
let nativeWatcher: string | null = null;
let webWatcher: number | null = null;
let last: { lat: number; lng: number; at: number } | null = null;
const listeners = new Set<(s: TrackerStatus) => void>();

/** Your position on this device (for your own dot on the map). */
export interface LocalFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: number;
}
let fix: LocalFix | null = null;
const fixListeners = new Set<(f: LocalFix) => void>();
function emitFix(lat: number, lng: number, accuracy: number | null | undefined) {
  fix = { lat, lng, accuracy: accuracy ?? null, at: Date.now() };
  fixListeners.forEach((fn) => fn(fix!));
}

function setStatus(s: TrackerStatus) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}

function report(p: { lat: number; lng: number; accuracy?: number | null; heading?: number | null; speed?: number | null }) {
  const now = Date.now();
  if (last) {
    const moved = metres(last, p);
    const age = now - last.at;
    if (age < 10_000 && moved < 20) return;
    if (age < 60_000 && moved < 5) return;
  }
  last = { lat: p.lat, lng: p.lng, at: now };
  sendPosition(p).catch(() => {
    last = null; // try again with the next update
  });
}

export function trackerStatus() {
  return status;
}

export function onTrackerStatus(fn: (s: TrackerStatus) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Start sending your position (asks for permission the first time). */
export async function startTracking(texts: { title: string; message: string }) {
  if (status === "running") return;
  if (isNativeApp()) {
    try {
      nativeWatcher = await BackgroundGeolocation.addWatcher(
        { backgroundTitle: texts.title, backgroundMessage: texts.message, requestPermissions: true, stale: false, distanceFilter: 10 },
        (position, error) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") setStatus("denied");
            return;
          }
          if (!position) return;
          if (status !== "running") setStatus("running");
          emitFix(position.latitude, position.longitude, position.accuracy);
          report({ lat: position.latitude, lng: position.longitude, accuracy: position.accuracy, heading: position.bearing, speed: position.speed });
        },
      );
      setStatus("running");
    } catch {
      setStatus("unavailable");
    }
    return;
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return setStatus("unavailable");
  webWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      if (status !== "running") setStatus("running");
      emitFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      report({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed });
    },
    (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
    { enableHighAccuracy: true, maximumAge: 10_000 },
  );
  setStatus("running");
}

export async function stopTracking() {
  if (nativeWatcher) {
    const id = nativeWatcher;
    nativeWatcher = null;
    await BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
  }
  if (webWatcher !== null) {
    navigator.geolocation.clearWatch(webWatcher);
    webWatcher = null;
  }
  last = null;
  setStatus("idle");
}

/** iOS: open Speak's page in Settings (to switch location to "Always"). */
export function openLocationSettings() {
  if (isNativeApp()) void BackgroundGeolocation.openSettings().catch(() => {});
}

/** Latest position of this device (may be a few seconds old), or null. */
export function localFix(): LocalFix | null {
  return fix;
}

export function onLocalFix(fn: (f: LocalFix) => void): () => void {
  fixListeners.add(fn);
  return () => void fixListeners.delete(fn);
}

let localUsers = 0;
let localNative: string | null = null;
let localWeb: number | null = null;

/**
 * Follow your position while a screen needs it (the map), foreground only, nothing sent. Returns the stop.
 * onDenied: location permission refused.
 */
export function watchLocal(onDenied?: () => void): () => void {
  localUsers++;
  if (localUsers === 1) {
    if (isNativeApp()) {
      void BackgroundGeolocation.addWatcher({ requestPermissions: true, stale: false, distanceFilter: 5 }, (position, error) => {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") onDenied?.();
          return;
        }
        if (position) emitFix(position.latitude, position.longitude, position.accuracy);
      })
        .then((id) => {
          if (localUsers > 0) localNative = id;
          else void BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
        })
        .catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.geolocation) {
      localWeb = navigator.geolocation.watchPosition(
        (pos) => emitFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => err.code === err.PERMISSION_DENIED && onDenied?.(),
        { enableHighAccuracy: true, maximumAge: 5_000 },
      );
    }
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    localUsers--;
    if (localUsers > 0) return;
    if (localNative) {
      const id = localNative;
      localNative = null;
      void BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
    }
    if (localWeb !== null) {
      navigator.geolocation.clearWatch(localWeb);
      localWeb = null;
    }
  };
}
