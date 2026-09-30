import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LocateFixed, MapPin, Users } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { LiveMap } from "@/components/map/live-map";
import { UserAvatar } from "@/components/user-avatar";
import { locationKeys, mapPeople, mySharing, type MapPerson } from "@/lib/location/api";
import { formatDistance } from "@/lib/location/format";
import { timeAgoShort } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

const RADII = [100, 250, 500] as const;

/**
 * Live map: you in the middle of a 100 / 250 / 500 m circle, everyone within it who shares with everyone, and your
 * friends wherever they are. Refreshes every 10 s. Tap someone → who they are, how far, their profile.
 */
function MapPage() {
  const { t, i18n } = useTranslation();
  const sharing = useQuery({ queryKey: locationKeys.sharing, queryFn: mySharing, refetchInterval: 10_000 });
  const [radius, setRadius] = useState<number>(500);
  const on = !!sharing.data && sharing.data.mode !== "off";
  const people = useQuery({ queryKey: locationKeys.people(radius), queryFn: () => mapPeople(radius), enabled: on, refetchInterval: 10_000 });
  const [selected, setSelected] = useState<MapPerson | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [recenter, setRecenter] = useState(0);

  const s = sharing.data;
  const me = on && s?.lat != null && s?.lng != null ? { lat: s.lat, lng: s.lng } : null;
  const list = people.data ?? [];
  const nearby = list.filter((p) => p.distance_m <= radius);
  // Keep the open sheet in step with the latest position of that person.
  const current = selected ? (list.find((p) => p.user_id === selected.user_id) ?? selected) : null;

  return (
    <div className="fixed inset-0 z-0 bg-black">
      <LiveMap me={me} radius={radius} people={list} onSelect={setSelected} recenterKey={recenter} />

      {/* top: title + radius */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#141415]/90 p-1 shadow-lg backdrop-blur">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={radius === r}
              onClick={() => {
                setRadius(r);
                setRecenter((k) => k + 1);
              }}
              className={cn("h-9 rounded-full px-4 text-sm font-semibold", radius === r ? "bg-primary text-primary-foreground" : "text-foreground/90")}
            >
              {formatDistance(r, i18n.language)}
            </button>
          ))}
        </div>
      </div>

      {/* bottom: who is nearby + recenter (above the floating nav) */}
      {on && (
        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-10 flex items-center justify-between gap-2 px-4">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="flex h-12 items-center gap-2 rounded-full bg-[#141415]/90 px-5 text-[15px] font-semibold shadow-lg backdrop-blur"
          >
            <Users className="h-5 w-5" /> {t("map.nearby", { count: nearby.length })}
          </button>
          <button
            type="button"
            onClick={() => setRecenter((k) => k + 1)}
            aria-label={t("map.recenter")}
            className="grid h-12 w-12 place-items-center rounded-full bg-[#141415]/90 shadow-lg backdrop-blur"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* sharing off / waiting */}
      {s && (!on || !me) && (
        <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-10 mx-auto max-w-md rounded-3xl bg-[#141415]/95 p-5 shadow-xl backdrop-blur">
          <p className="flex items-center gap-2 text-lg font-bold">
            <MapPin className="h-5 w-5 text-coral" /> {t(on ? "map.waitingTitle" : "map.offTitle")}
          </p>
          <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{t(on ? "map.waiting" : "map.off")}</p>
          {!on && (
            <Link to="/location" className="mt-4 flex h-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              {t("map.turnOn")}
            </Link>
          )}
        </div>
      )}

      {/* nearby list */}
      <Drawer open={listOpen} onOpenChange={setListOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerTitle className="px-4 pt-2 text-lg font-bold">{t("map.nearby", { count: nearby.length })}</DrawerTitle>
          <DrawerDescription className="px-4 text-sm text-muted-foreground">{t("map.listHint", { radius: formatDistance(radius, i18n.language) })}</DrawerDescription>
          <ul className="overflow-y-auto px-4 pb-8 pt-2">
            {list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{t("map.nobody")}</li>}
            {list.map((p) => (
              <li key={p.user_id}>
                <button
                  type="button"
                  onClick={() => {
                    setListOpen(false);
                    setSelected(p);
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span className={cn("rounded-full p-0.5 ring-2", p.is_friend ? "ring-emerald-500" : "ring-transparent")}>
                    <UserAvatar name={p.full_name || p.username} path={p.avatar_path} size={44} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.full_name || p.username}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[formatDistance(p.distance_m, i18n.language), p.is_friend ? t("map.friend") : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>

      {/* one person */}
      <Drawer open={!!current} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent>
          {current && (
            <div className="px-5 pb-8 pt-3">
              <div className="flex items-center gap-4">
                <span className={cn("rounded-full p-1 ring-4", current.is_friend ? "ring-emerald-500" : "ring-white/80")}>
                  <UserAvatar name={current.full_name || current.username} path={current.avatar_path} size={64} />
                </span>
                <div className="min-w-0">
                  <DrawerTitle className="truncate text-xl font-bold">{current.full_name || current.username}</DrawerTitle>
                  <DrawerDescription className="truncate text-sm text-muted-foreground">@{current.username}</DrawerDescription>
                  <p className="mt-0.5 text-sm font-semibold text-coral">
                    {t("map.away", { distance: formatDistance(current.distance_m, i18n.language) })} · {timeAgoShort(current.updated_at, i18n.language)}
                  </p>
                </div>
              </div>
              <Link
                to="/u/$username"
                params={{ username: current.username }}
                className="mt-5 flex h-12 items-center justify-center rounded-full bg-secondary font-semibold"
              >
                {t("map.profile")}
              </Link>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
