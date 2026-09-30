import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, MapPin, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { isNativeApp } from "@/lib/native";
import { locationKeys, mySharing, setSharing, type ShareMode, type TalkFrom } from "@/lib/location/api";
import { onTrackerStatus, openLocationSettings, trackerStatus, type TrackerStatus } from "@/lib/location/tracker";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/location")({
  component: LocationPage,
});

const MODES: ShareMode[] = ["off", "friends", "everyone"];
const TALK: TalkFrom[] = ["everyone", "following", "nobody"];

/**
 * Location sharing for the live map: off / friends / everyone nearby (500 m), who may talk to you, and whether the
 * phone is actually sending (permission, last update). "Everyone" asks for a confirmation first.
 */
function LocationPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const sharing = useQuery({ queryKey: locationKeys.sharing, queryFn: mySharing, refetchInterval: 30_000 });
  const [confirmEveryone, setConfirmEveryone] = useState(false);
  const [tracker, setTracker] = useState<TrackerStatus>(trackerStatus);
  useEffect(() => onTrackerStatus(setTracker), []);

  const save = useMutation({
    mutationFn: ({ mode, talk }: { mode: ShareMode; talk?: TalkFrom }) => setSharing(mode, talk),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["location"] }),
    onError: () => toast.error(t("errors.generic")),
  });

  const s = sharing.data;
  const pick = (m: ShareMode) => {
    if (!s || m === s.mode) return;
    if (m === "everyone") return setConfirmEveryone(true);
    setConfirmEveryone(false);
    save.mutate({ mode: m });
  };

  return (
    <>
      <AppHeader back title={t("location.title")} />
      <div className="space-y-6 px-4 pb-10 pt-2">
        <p className="text-[15px] leading-snug text-muted-foreground">{t("location.intro")}</p>

        <ul className="space-y-2" role="radiogroup">
          {MODES.map((m) => (
            <li key={m}>
              <button
                type="button"
                role="radio"
                aria-checked={s?.mode === m}
                disabled={!s || save.isPending}
                onClick={() => pick(m)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left",
                  s?.mode === m ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{t(`location.mode.${m}`)}</span>
                  <span className={cn("block text-sm leading-snug", s?.mode === m ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {t(`location.modeHint.${m}`)}
                  </span>
                </span>
                {s?.mode === m && <Check className="mt-1 h-5 w-5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>

        {confirmEveryone && (
          <div className="space-y-3 rounded-2xl border border-coral/60 bg-coral/10 p-4">
            <p className="flex items-start gap-2 text-[15px] leading-snug">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
              {t("location.everyoneWarning")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmEveryone(false);
                  save.mutate({ mode: "everyone" });
                }}
                className="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground"
              >
                {t("location.everyoneConfirm")}
              </button>
              <button type="button" onClick={() => setConfirmEveryone(false)} className="h-11 flex-1 rounded-full bg-secondary font-semibold">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {s && s.mode !== "off" && (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("location.talkTitle")}</h2>
              <div className="flex flex-wrap gap-2">
                {TALK.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={s.talk_from === k}
                    disabled={save.isPending}
                    onClick={() => save.mutate({ mode: s.mode, talk: k })}
                    className={cn("h-10 rounded-full px-4 text-[15px] font-semibold", s.talk_from === k ? "bg-primary text-primary-foreground" : "bg-secondary")}
                  >
                    {t(`location.talk.${k}`)}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex items-start gap-3 rounded-2xl bg-secondary p-4">
              <MapPin className={cn("mt-0.5 h-5 w-5 shrink-0", tracker === "denied" ? "text-destructive" : "text-emerald-500")} />
              <div className="min-w-0 flex-1 text-[15px] leading-snug">
                {tracker === "denied" ? (
                  <>
                    <p className="font-semibold">{t("location.denied")}</p>
                    {isNativeApp() ? (
                      <button type="button" onClick={openLocationSettings} className="mt-1 font-semibold text-[#0a84ff]">
                        {t("location.openSettings")}
                      </button>
                    ) : (
                      <p className="text-muted-foreground">{t("location.deniedWeb")}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold">
                      {s.position_at ? t("location.updated", { when: timeAgo(s.position_at, i18n.language) }) : t("location.waiting")}
                    </p>
                    <p className="text-muted-foreground">{t(isNativeApp() ? "location.alwaysHint" : "location.webHint")}</p>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
