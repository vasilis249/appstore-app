import { isNativeApp } from "@/lib/native";

export type LatLng = { lat: number; lng: number };

/**
 * Current device position, used only on the device to compute distances to
 * venues (never sent to the server). In the iOS app this goes through the
 * native plugin, so the user sees one iOS permission prompt instead of the
 * WebView's extra "website wants your location" prompt.
 */
export async function getCurrentPosition(): Promise<LatLng> {
  if (isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function formatKm(km: number, locale: string): string {
  return km < 10
    ? `${km.toLocaleString(locale, { maximumFractionDigits: 1 })} km`
    : `${Math.round(km)} km`;
}
