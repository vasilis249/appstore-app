// Singleton loader for Google Maps JS API.
import { getMapsApiKey } from "@/lib/api/maps.functions";

type GoogleNS = typeof globalThis extends { google: infer G } ? G : any;

let loadPromise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  const w = window as any;
  if (w.google?.maps) {
    return Promise.resolve(w.google);
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { apiKey } = await getMapsApiKey();
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    return new Promise<any>((resolve, reject) => {
      const cbName = `__gmapsReady_${Math.random().toString(36).slice(2)}`;
      (window as any)[cbName] = () => {
        delete (window as any)[cbName];
        resolve((window as any).google);
      };
      const script = document.createElement("script");
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&libraries=places,marker&loading=async&callback=${cbName}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete (window as any)[cbName];
        loadPromise = null;
        reject(new Error("Failed to load Google Maps"));
      };
      document.head.appendChild(script);
    });
  })();

  return loadPromise;
}

export type _Google = GoogleNS;
