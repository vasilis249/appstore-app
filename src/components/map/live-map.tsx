import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { avatarUrl } from "@/lib/avatar";
import type { MapPerson } from "@/lib/location/api";

/**
 * The live map: OpenFreeMap's dark style (free, no key), you as a blue dot with the radius circle, everyone else as
 * a round photo (green ring = friend, pulsing coral = talking to you). MapLibre is loaded on demand; markers are plain DOM buttons.
 */

const STYLE = "https://tiles.openfreemap.org/styles/dark";
const ATHENS: [number, number] = [23.7275, 37.9838];

export interface LivePosition {
  lat: number;
  lng: number;
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

function personElement(p: MapPerson, talking: boolean, onSelect: (p: MapPerson) => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", p.full_name || p.username);
  el.className = `grid h-11 w-11 place-items-center overflow-hidden rounded-full border-[3px] bg-[#2c2c2e] text-base font-bold text-white shadow-lg ${
    talking ? "animate-pulse border-coral ring-4 ring-coral/40" : p.is_friend ? "border-emerald-500" : "border-white"
  }`;
  if (talking) el.dataset.talking = "1";
  const url = avatarUrl(p.avatar_path);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.className = "h-full w-full object-cover";
    el.appendChild(img);
  } else {
    el.textContent = (p.full_name || p.username || "?").trim().charAt(0).toUpperCase();
  }
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(p);
  });
  return el;
}

export function LiveMap({
  me,
  radius,
  people,
  onSelect,
  recenterKey,
  talking,
}: {
  me: LivePosition | null;
  radius: number;
  people: MapPerson[];
  /** People talking to you right now. */
  talking: string[];
  onSelect: (p: MapPerson) => void;
  /** Change it to fit the map to your radius again. */
  recenterKey: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; sig: string }>());
  const meMarker = useRef<Marker | null>(null);
  const styleReady = useRef(false);
  const fitted = useRef(false);
  const latest = useRef({ me, radius, people, onSelect, talking });
  latest.current = { me, radius, people, onSelect, talking };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl").then((ml) => {
      if (cancelled || !box.current) return;
      lib.current = ml;
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: me ? [me.lng, me.lat] : ATHENS,
        zoom: me ? 15 : 11,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      m.on("load", () => {
        styleReady.current = true;
        m.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#e4571c", "fill-opacity": 0.08 } });
        m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#e4571c", "line-width": 1.5, "line-opacity": 0.7 } });
        drawRadius();
      });
      map.current = m;
      sync();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
      meMarker.current = null;
      styleReady.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawRadius() {
    const m = map.current;
    const { me: pos, radius: r } = latest.current;
    if (!m || !styleReady.current) return;
    const src = m.getSource("radius") as { setData: (d: unknown) => void } | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: pos ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circle(pos, r)] } }] : [],
    });
  }

  /** Frame your radius: a jump the first time, a short glide when you ask for it. */
  function fit(animate = true) {
    const m = map.current;
    const { me: pos, radius: r } = latest.current;
    if (!m || !pos) return;
    const ring = circle(pos, r, 16);
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const cam = m.cameraForBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: 48 });
    if (!cam) return;
    if (animate) m.easeTo({ ...cam, duration: 500 });
    else m.jumpTo(cam);
  }

  function sync() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const { me: pos, people: list, onSelect: select, talking: live } = latest.current;
    // you
    if (pos) {
      if (!meMarker.current) {
        const dot = document.createElement("div");
        dot.setAttribute("aria-label", "me");
        dot.className = "h-5 w-5 rounded-full border-[3px] border-white bg-[#0a84ff] shadow-[0_0_0_6px_rgba(10,132,255,0.25)]";
        meMarker.current = new ml.Marker({ element: dot }).setLngLat([pos.lng, pos.lat]).addTo(m);
      } else meMarker.current.setLngLat([pos.lng, pos.lat]);
      if (!fitted.current) {
        fitted.current = true;
        fit(false);
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
    drawRadius();
  }

  const talkingKey = talking.join();
  useEffect(sync, [me?.lat, me?.lng, people, radius, talkingKey]);
  useEffect(() => {
    if (recenterKey) fit();
  }, [recenterKey, radius]);

  // MapLibre makes its container position: relative, so it gets its own full-size box inside the absolute one.
  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
