import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { locationKeys, mySharing } from "@/lib/location/api";
import { startTracking, stopTracking } from "@/lib/location/tracker";

/** Root: sends your position while location sharing is on (and stops on sign-out / off). */
export function LocationSync() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const sharing = useQuery({ queryKey: locationKeys.sharing, queryFn: mySharing, enabled: !!user, staleTime: 60_000 });
  const on = !!user && !!sharing.data && sharing.data.mode !== "off";

  useEffect(() => {
    if (on) void startTracking({ title: t("location.bgTitle"), message: t("location.bgMessage") });
    else void stopTracking();
  }, [on, t]);

  return null;
}
