import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

/**
 * Translate user-generated text on demand via the DeepL-backed edge endpoint.
 * Returns the original text immediately when the active language is Greek (source).
 */
export function useTranslatedText(text: string | null | undefined): string {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? "el").toLowerCase();
  const target = lang.startsWith("en") ? "EN" : "EL";
  const source = "EL";
  const skip = !text || target === source;

  const { data } = useQuery({
    queryKey: ["dl-translate", source, target, text],
    enabled: !skip,
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: [text], source, target }),
        });
        if (!res.ok) return text ?? "";
        const json = (await res.json()) as { translations?: string[] };
        return json.translations?.[0] ?? text ?? "";
      } catch {
        return text ?? "";
      }
    },
  });

  if (skip) return text ?? "";
  return data ?? (text ?? "");
}
