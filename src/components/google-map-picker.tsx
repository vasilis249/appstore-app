import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

export type PickedPlace = {
  lat: number;
  lng: number;
  placeId: string | null;
  formattedAddress: string;
  area?: string | null;
};

type Props = {
  initial?: { lat: number | null; lng: number | null; address: string | null; placeId: string | null };
  onChange: (p: PickedPlace) => void;
};

const ATHENS = { lat: 37.9838, lng: 23.7275 };

function extractArea(components: any[] | undefined): string | null {
  if (!components) return null;
  const find = (type: string) =>
    components.find((c) => c.types?.includes(type))?.long_name as string | undefined;
  return (
    find("neighborhood") ||
    find("sublocality") ||
    find("sublocality_level_1") ||
    find("locality") ||
    find("administrative_area_level_3") ||
    find("administrative_area_level_2") ||
    null
  );
}

export function GoogleMapPicker({ initial, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then(async (google: any) => {
        if (!mounted || !mapDivRef.current || !inputRef.current) return;

        // Ensure places library is loaded (legacy classes used here)
        try {
          await google.maps.importLibrary("places");
        } catch {
          /* already loaded */
        }

        const start = {
          lat: initial?.lat ?? ATHENS.lat,
          lng: initial?.lng ?? ATHENS.lng,
        };
        const map = new google.maps.Map(mapDivRef.current, {
          center: start,
          zoom: initial?.lat ? 16 : 12,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

        const marker = new google.maps.Marker({
          position: start,
          map,
          draggable: true,
        });
        markerRef.current = marker;

        geocoderRef.current = new google.maps.Geocoder();

        // Reverse geocode on drag
        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (!p) return;
          const lat = p.lat();
          const lng = p.lng();
          geocoderRef.current.geocode(
            { location: { lat, lng } },
            (results: any[], status: string) => {
              if (status === "OK" && results?.[0]) {
                const r = results[0];
                const formatted = r.formatted_address ?? "";
                if (inputRef.current) inputRef.current.value = formatted;
                onChange({
                  lat,
                  lng,
                  placeId: r.place_id ?? null,
                  formattedAddress: formatted,
                  area: extractArea(r.address_components),
                });
              } else {
                onChange({
                  lat,
                  lng,
                  placeId: null,
                  formattedAddress: initial?.address ?? "",
                });
              }
            },
          );
        });

        // Click on map to move marker
        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          google.maps.event.trigger(marker, "dragend");
        });

        // Legacy Places Autocomplete bound to input
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["place_id", "geometry", "formatted_address", "address_components", "name"],
          componentRestrictions: { country: "gr" },
        });
        ac.bindTo("bounds", map);
        autocompleteRef.current = ac;

        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          map.setCenter({ lat, lng });
          map.setZoom(17);
          marker.setPosition({ lat, lng });
          const formatted = place.formatted_address ?? place.name ?? "";
          if (inputRef.current) inputRef.current.value = formatted;
          onChange({
            lat,
            lng,
            placeId: place.place_id ?? null,
            formattedAddress: formatted,
            area: extractArea(place.address_components),
          });
        });

        if (initial?.address && inputRef.current) {
          inputRef.current.value = initial.address;
        }
        setReady(true);
      })
      .catch((e) => setError(e.message ?? "Δεν φόρτωσε ο χάρτης"));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Ψάξε διεύθυνση…"
          autoComplete="off"
          className="w-full bg-transparent text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </div>
      <div
        ref={mapDivRef}
        className="h-72 w-full rounded-xl border border-border/60 bg-surface"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && !ready && (
        <p className="text-xs text-muted-foreground">Φόρτωση χάρτη…</p>
      )}
      <p className="text-xs text-muted-foreground">
        Σύρε τον δείκτη ή κάνε κλικ στον χάρτη για το ακριβές σημείο.
      </p>
    </div>
  );
}
