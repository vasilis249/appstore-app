import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import el from "./locales/el.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGS = ["el", "en"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const LANG_STORAGE_KEY = "courtsie:lang";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      el: { translation: el },
      en: { translation: en },
    },
    // Always start in Greek so SSR HTML matches the first client render.
    // The actual user preference is applied after hydration (see hydrateLanguage()).
    lng: "el",
    fallbackLng: "el",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

/** Call once on the client (after mount) to apply the saved language. */
export function hydrateLanguage() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored as AppLang) && i18n.language !== stored) {
      void i18n.changeLanguage(stored);
    }
  } catch {
    /* ignore */
  }
}

export default i18n;

