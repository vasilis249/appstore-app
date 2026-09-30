import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { avatarUrl } from "@/lib/avatar";
import type { MapPerson } from "@/lib/location/api";

/**
 * The live map, like Snap Map / Find My: a normal street map (OpenFreeMap "liberty", free, no key), you as your photo
 * with a blue ring and an accuracy halo, everyone else as a round photo with their first name (green ring = friend,
 * pulsing coral = talking to you). Optional radius circle (the "Κοντά μου" view). MapLibre is loaded on demand;
 * markers are plain DOM elements.
 */

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ATHENS: [number, number] = [23.7275, 37.9838];
const ME_ZOOM = 15;

export interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

/** Where to move the camera: yourself, your radius, or a point (a friend). Change `key` to move again. */
export interface MapFocus {
  key: number;
  target: "me" | "radius" | { lat: number; lng: number };
}

function circle(center: LivePosition, radiusM: number, steps = 72): [number, number][] {
  const pts: [number, number][] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    pts.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return pts;
}

function face(name: string, path: string | null, className: string): HTMLElement {
  const el = document.createElement("span");
  el.className = `grid place-items-center overflow-hidden rounded-full bg-[#2c2c2e] font-bold text-white shadow-lg ${className}`;
  const url = avatarUrl(path);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.className = "h-full w-full object-cover";
    el.appendChild(img);
  } else {
    el.textContent = (name || "?").trim().charAt(0).toUpperCase();
  }
  return el;
}

function personElement(p: MapPerson, talking: boolean, onSelect: (p: MapPerson) => void): HTMLElement {
  const name = p.full_name || p.username;
  const wrap = document.createElement("div");
  wrap.className = "relative h-12 w-12";
  if (talking) wrap.dataset.talking = "1";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", name);
  btn.className = "block h-12 w-12 rounded-full";
  btn.appendChild(
    face(
      name,
      p.avatar_path,
      `h-12 w-12 border-[3px] text-base ${talking ? "animate-pulse border-coral ring-4 ring-coral/40" : p.is_friend ? "border-emerald-500" : "border-white"}`,
    ),
  );
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(p);
  });
  const label = document.createElement("span");
  label.className =
    "pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow";
  label.textContent = name.split(" ")[0];
  wrap.append(btn, label);
  return wrap;
}

function meElement(name: string, path: string | null): HTMLElement {
  const wrap = document.createElement("div");
  wrap.setAttribute("aria-label", "me");
  wrap.className = "relative grid h-12 w-12 place-items-center";
  const pulse = document.createElement("span");
  pulse.className = "absolute inset-0 animate-ping rounded-full bg-[#0a84ff]/30";
  wrap.append(pulse, face(name, path, "relative h-11 w-11 border-[3px] border-[#0a84ff] text-base"));
  return wrap;
}

export function LiveMap({
  me,
  meFace,
  radius,
  people,
  onSelect,
  focus,
  talking,
}: {
  me: LivePosition | null;
  meFace: { name: string; path: string | null };
  /** Draw this radius around you (the nearby view), or null. */
  radius: number | null;
  people: MapPerson[];
  onSelect: (p: MapPerson) => void;
  focus: MapFocus | null;
  /** People talking to you right now. */
  talking: string[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; sig: string }>());
  const meMarker = useRef<{ marker: Marker; sig: string } | null>(null);
  const styleReady = useRef(false);
  const placed = useRef(false);
  const latest = useRef({ me, meFace, radius, people, onSelect, talking });
  latest.current = { me, meFace, radius, people, onSelect, talking };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const all = markers.current;
    void import("maplibre-gl").then((ml) => {
      if (cancelled || !box.current) return;
      lib.current = ml;
      const start = latest.current.me;
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: start ? [start.lng, start.lat] : ATHENS,
        zoom: start ? ME_ZOOM : 11,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      m.on("load", () => {
        styleReady.current = true;
        const empty = { type: "FeatureCollection" as const, features: [] };
        m.addSource("radius", { type: "geojson", data: empty });
        m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#e4571c", "fill-opacity": 0.08 } });
        m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#e4571c", "line-width": 1.5, "line-opacity": 0.8 } });
        m.addSource("me-acc", { type: "geojson", data: empty });
        m.addLayer({ id: "me-acc-fill", type: "fill", source: "me-acc", paint: { "fill-color": "#0a84ff", "fill-opacity": 0.12 } });
        m.addLayer({ id: "me-acc-line", type: "line", source: "me-acc", paint: { "line-color": "#0a84ff", "line-width": 1, "line-opacity": 0.4 } });
        drawAreas();
      });
      map.current = m;
      sync();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      all.clear();
      meMarker.current = null;
      styleReady.current = false;
      placed.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawAreas() {
    const m = map.current;
    const { me: pos, radius: r } = latest.current;
    if (!m || !styleReady.current) return;
    const set = (id: string, ring: [number, number][] | null) =>
      (m.getSource(id) as { setData: (d: unknown) => void } | undefined)?.setData({
        type: "FeatureCollection",
        features: ring ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] : [],
      });
    set("radius", pos && r ? circle(pos, r) : null);
    set("me-acc", pos?.accuracy && pos.accuracy > 15 ? circle(pos, Math.min(pos.accuracy, 2000), 48) : null);
  }

  function frameRadius(animate: boolean) {
    const m = map.current;
    const { me: pos, radius: r } = latest.current;
    if (!m || !pos || !r) return;
    const ring = circle(pos, r, 16);
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const cam = m.cameraForBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: 56 });
    if (!cam) return;
    // A jump while the style may still be loading (an animated move would never finish then).
    if (animate) m.easeTo({ ...cam, duration: 600 });
    else m.jumpTo(cam);
  }

  function sync() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const { me: pos, meFace: mf, radius: r, people: list, onSelect: select, talking: live } = latest.current;
    // you
    if (pos) {
      const sig = `${mf.name}|${mf.path}`;
      if (!meMarker.current || meMarker.current.sig !== sig) {
        meMarker.current?.marker.remove();
        meMarker.current = { marker: new ml.Marker({ element: meElement(mf.name, mf.path) }).setLngLat([pos.lng, pos.lat]).addTo(m), sig };
      } else meMarker.current.marker.setLngLat([pos.lng, pos.lat]);
      if (!placed.current) {
        placed.current = true;
        if (r) frameRadius(false);
        else m.jumpTo({ center: [pos.lng, pos.lat], zoom: ME_ZOOM });
      }
    }
    // everyone else
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.user_id);
      const talks = live.includes(p.user_id);
      const sig = `${p.avatar_path}|${p.is_friend}|${p.full_name}|${talks}`;
      const cur = markers.current.get(p.user_id);
      if (cur && cur.sig === sig) {
        cur.marker.setLngLat([p.lng, p.lat]);
        continue;
      }
      cur?.marker.remove();
      const marker = new ml.Marker({ element: personElement(p, talks, select) }).setLngLat([p.lng, p.lat]).addTo(m);
      markers.current.set(p.user_id, { marker, sig });
    }
    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    drawAreas();
  }

  const talkingKey = talking.join();
  useEffect(sync, [me?.lat, me?.lng, me?.accuracy, meFace.name, meFace.path, people, radius, talkingKey]);

  // Camera requests: back to you, your radius, or a friend.
  useEffect(() => {
    const m = map.current;
    if (!focus || !m) return;
    const t = focus.target;
    if (t === "radius") return frameRadius(true);
    const pos = t === "me" ? latest.current.me : t;
    if (!pos) return;
    m.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(m.getZoom(), ME_ZOOM), duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  // MapLibre makes its container position: relative, so it gets its own full-size box inside the absolute one.
  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
