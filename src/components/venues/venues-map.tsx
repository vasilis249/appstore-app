import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import type { LatLng } from "@/lib/geo";
import type { VenueListItem } from "@/lib/api/venues.functions";

// Muted grey basemap so the pins stand out (as in the design reference).
const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#f2f2f4" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a7a80" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f7f7f8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e6e6ea" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dcdde2" }] },
];

function pinIcon(g: typeof google, color: string, big: boolean): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 47c-1.2 0-2-1-2.6-2C12 36.8 4 30.6 4 20a16 16 0 0 1 32 0c0 10.6-8 16.8-13.4 25-.6 1-1.4 2-2.6 2z" fill="${color}"/><circle cx="20" cy="20" r="6.5" fill="#fff"/></svg>`;
  const w = big ? 44 : 34;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(w, Math.round(w * 1.2)),
    anchor: new g.maps.Point(w / 2, Math.round(w * 1.2)),
  };
}

type Props = {
  venues: VenueListItem[];
  myPos: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Google map with one pin per venue that has coordinates. */
export function VenuesMap({ venues, myPos, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const googleRef = useRef<typeof google | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const meRef = useRef<google.maps.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then((g: typeof google) => {
        if (!alive || !el.current) return;
        googleRef.current = g;
        mapRef.current = new g.maps.Map(el.current, {
          center: { lat: 37.98, lng: 23.73 }, // Athens until the pins are fitted
          zoom: 11,
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setReady(true);
      })
      .catch(() => alive && setError(t("venueMap.unavailable")));
    return () => {
      alive = false;
    };
  }, [t]);

  // (Re)draw pins and fit the viewport when the venue set changes.
  useEffect(() => {
    const g = googleRef.current;
    const map = mapRef.current;
    if (!ready || !g || !map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    const bounds = new g.maps.LatLngBounds();
    for (const v of venues) {
      if (v.lat == null || v.lng == null) continue;
      const marker = new g.maps.Marker({
        map,
        position: { lat: v.lat, lng: v.lng },
        title: v.name,
        icon: pinIcon(g, "#1C1C1E", false),
      });
      marker.addListener("click", () => onSelectRef.current(v.id));
      markersRef.current.set(v.id, marker);
      bounds.extend({ lat: v.lat, lng: v.lng });
    }
    if (myPos) bounds.extend(myPos);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48);
      g.maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
      });
    }
  }, [ready, venues, myPos]);

  // Highlight the selected venue.
  useEffect(() => {
    const g = googleRef.current;
    if (!ready || !g) return;
    markersRef.current.forEach((m, id) => {
      const on = id === selectedId;
      m.setIcon(pinIcon(g, on ? "#E4571C" : "#1C1C1E", on));
      m.setZIndex(on ? 10 : 1);
      const pos = m.getPosition();
      if (on && pos) mapRef.current?.panTo(pos);
    });
  }, [ready, selectedId, venues]);

  // Blue dot for the user's position.
  useEffect(() => {
    const g = googleRef.current;
    if (!ready || !g) return;
    meRef.current?.setMap(null);
    meRef.current = myPos
      ? new g.maps.Marker({
          map: mapRef.current,
          position: myPos,
          title: t("venueMap.you"),
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#2D7FF9",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          zIndex: 20,
        })
      : null;
  }, [ready, myPos, t]);

  const missing = venues.filter((v) => v.lat == null || v.lng == null).length;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-muted">
      <div ref={el} className="h-full w-full" />
      {error && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          {error}
        </p>
      )}
      {!error && missing > 0 && (
        <p className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
          {t("venueMap.missing", { count: missing })}
        </p>
      )}
    </div>
  );
}
