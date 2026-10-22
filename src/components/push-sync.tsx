import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { enablePush, listenPush } from "@/lib/push";

/** Students in the app: re-register this device on start / language change (no dialog), open the route of a tapped push. */
export function PushSync() {
  const { i18n } = useTranslation();
  const router = useRouter();
  useEffect(() => {
    let off: (() => void) | undefined;
    let gone = false;
    void listenPush(i18n.language, (route) => router.history.push(route)).then((f) => {
      if (gone) f();
      else off = f;
      void enablePush(false);
    });
    return () => {
      gone = true;
      off?.();
    };
  }, [i18n.language, router]);
  return null;
}
