import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { isNativeApp } from "@/lib/native";
import {
  dailyPromptOn,
  promptPermission,
  requestPromptPermission,
  setDailyPromptOn,
  syncDailyPrompts,
} from "@/lib/prompt-notifications";

/** Settings row: turn the daily prompt notification on/off (only inside the iOS app). */
export function DailyPromptSwitch({ className }: { className: string }) {
  const { t } = useTranslation();
  const [on, setOn] = useState(false);
  useEffect(() => {
    void promptPermission().then((p) => setOn(p === "granted" && dailyPromptOn()));
  }, []);
  if (!isNativeApp()) return null;

  async function change(next: boolean) {
    if (next) {
      let p = await promptPermission();
      if (p === "prompt") p = await requestPromptPermission();
      if (p !== "granted") {
        toast.error(t("settings.dailyPromptDenied"));
        return;
      }
    }
    setDailyPromptOn(next);
    setOn(next);
    await syncDailyPrompts();
  }

  return (
    <label className={className}>
      <span>{t("settings.dailyPrompt")}</span>
      <Switch checked={on} onCheckedChange={(v) => void change(v)} />
    </label>
  );
}
