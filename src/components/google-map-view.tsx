import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type Props = {
  lat: number;
  lng: number;
  label?: string;
};

export function GoogleMapView({ lat, lng, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google: any) => {
        if (!mounted || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: { lat, lng },
          zoom: 16,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });
        new google.maps.Marker({ position: { lat, lng }, map, title: label });
      })
      .catch((e) => setError(e.message ?? "Δεν φόρτωσε ο χάρτης"));
    return () => {
      mounted = false;
    };
  }, [lat, lng, label]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {error && (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
