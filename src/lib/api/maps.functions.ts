import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the Google Maps browser API key. The key is referrer-restricted
 * by the project owner so it is safe to expose to the browser.
 */
export const getMapsApiKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const key = process.env.GOOGLE_MAPS_API_KEY ?? "";
    return { apiKey: key };
  },
);
