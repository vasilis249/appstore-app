import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  createFileRoute,
  Link,
  notFound,
} from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MapPin,
  Star,
  LayoutGrid,
  Calendar,
  Clock,
  Users,
  Crown,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import {
  getVenue,
  listOpenGamesByVenue,
  joinOpenGame,
  leaveOpenGame,
  type OpenGameWithPlayers,
} from "../lib/api/venues.functions";
import { useServerFn } from "@tanstack/react-start";
import { SPORTS, type Sport } from "../lib/sports";

import { amenityMeta } from "../lib/amenities";
import { useAuth } from "../hooks/use-auth";
import { useTranslatedText } from "../hooks/use-translated-text";
import { useRedirectOwnersAway } from "../hooks/use-redirect-owners-away";
import { GoogleMapView } from "@/components/google-map-view";
import padelImg from "../assets/sport-padel.jpg";
import tennisImg from "../assets/sport-tennis.jpg";
import basketballImg from "../assets/sport-basketball.jpg";
import footballImg from "../assets/sport-football.jpg";
import volleyballImg from "../assets/sport-volleyball.jpg";
import beachVolleyImg from "../assets/sport-beach-volley.jpg";

const FALLBACK_IMG: Record<Sport, string> = {
  padel: padelImg,
  tennis: tennisImg,
  basketball: basketballImg,
  football: footballImg,
  volleyball: volleyballImg,
  beach_volley: beachVolleyImg,
};

const venueQuery = (id: string) =>
  queryOptions({
    queryKey: ["venue", id],
    queryFn: () => getVenue({ data: { id } }),
  });

const openGamesQuery = (venueId: string) =>
  queryOptions({
    queryKey: ["open-games", "venue", venueId],
    queryFn: () => listOpenGamesByVenue({ data: { venueId } }),
  });

export const Route = createFileRoute("/venues/$venueId")({
  loader: async ({ context, params }) => {
    const venue = await context.queryClient.ensureQueryData(venueQuery(params.venueId));
    if (!venue) throw notFound();
    // Open games are authenticated-only; fetched client-side when a session exists.
    return venue;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Courtsie` },
          { name: "description", content: `${loaderData.name} · ${loaderData.area}.` },
          { property: "og:image", content: loaderData.photo_url ?? "" },
        ]
      : [{ title: "Γήπεδο — Courtsie" }],
  }),
  errorComponent: ErrView,
  notFoundComponent: NotFoundView,
  component: VenuePage,
});

function ErrView({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <h1 className="text-xl font-semibold">{t("venuePage.errorTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  );
}
function NotFoundView() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <h1 className="text-xl font-semibold">{t("venuePage.notFoundTitle")}</h1>
      <Link to="/venues" className="mt-4 inline-block text-primary">{t("venuePage.backAll")}</Link>
    </div>
  );
}

function VenuePage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  useRedirectOwnersAway();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  const qc = useQueryClient();
  const translatedName = useTranslatedText(venue?.name ?? "");
  const translatedArea = useTranslatedText(venue?.area ?? "");

  // Realtime: refresh venue + its photos when changed
  useEffect(() => {
    const channel = supabase
      .channel(`venue-${venueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_photos", filter: `venue_id=eq.${venueId}` },
        () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "venues", filter: `id=eq.${venueId}` },
        () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, qc]);

  if (!venue) return null;

  const sportMeta = SPORTS.find((s) => s.id === venue.sport)!;
  const fallback = FALLBACK_IMG[venue.sport as Sport];
  const uploaded = (venue as any).photos as { id: string; url: string }[] | undefined;
  const uploadedUrls = (uploaded ?? []).map((p) => p.url);
  // Cover (photo_url) first, then any remaining uploads, then fallback
  const ordered = [
    venue.photo_url,
    ...uploadedUrls.filter((u) => u !== venue.photo_url),
  ].filter(Boolean) as string[];
  const photos = ordered.length > 0 ? ordered : [fallback];
  const displayName = translatedName || venue.name;
  const displayArea = translatedArea || venue.area;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-20">
      <Link to="/venues" search={{ sport: venue.sport as Sport }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("venuePage.backAll")}
      </Link>

      <Gallery photos={photos} alt={displayName} />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${sportMeta.tokenClass}`}>
              {t(`sports.${venue.sport}`)}
            </span>

            {venue.rating != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Star className="h-3 w-3 fill-primary text-primary" />
                {Number(venue.rating).toFixed(1)} <span className="font-normal text-muted-foreground">({venue.reviews_count})</span>
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{displayName}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {displayArea}
            <span className="mx-2">·</span>
            <LayoutGrid className="h-4 w-4" /> {venue.courts_count} {venue.courts_count === 1 ? t("common.court_one") : t("common.courts")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(() => {
            const SLOT_ENABLED: Record<Sport, boolean> = {
              padel: true, tennis: true, basketball: false, football: false, volleyball: false, beach_volley: false,
            };
            const slot = SLOT_ENABLED[venue.sport as Sport];
            const price = slot
              ? Number((venue as any).slot_price ?? 0)
              : Number(venue.base_price_per_hour);
            const noPrice = !price || price <= 0;
            return (
              <>
                <div className="rounded-2xl border border-border/60 bg-card px-5 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("venuePage.fromLabel")}</div>
                  {noPrice ? (
                    <div className="font-display text-sm font-semibold text-muted-foreground">
                      {t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
                    </div>
                  ) : (
                    <div className="font-display text-2xl font-bold">
                      €{price.toFixed(price < 10 ? 1 : 0)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {slot ? t("common.perPerson", "/ άτομο") : t("venuePage.perHour")}
                      </span>
                    </div>
                  )}
                </div>
                {noPrice ? (
                  <button
                    type="button"
                    disabled
                    title={t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
                    className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground opacity-60"
                  >
                    {t("venuePage.bookCta")}
                  </button>
                ) : (
                  <Link
                    to="/book/$venueId"
                    params={{ venueId }}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
                  >
                    {t("venuePage.bookCta")}
                  </Link>
                )}
              </>
            );
          })()}
        </div>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <LocationCard venue={venue} />
        <AmenitiesCard amenities={venue.amenities} />
      </section>

      <OpenGamesSection venueId={venueId} />
    </div>
  );
}

function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const main = photos[active] ?? photos[0];

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 md:col-span-3">
        <img src={main} alt={alt} className="aspect-[16/10] w-full object-cover" />
      </div>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
        {photos.slice(0, 3).map((p, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`overflow-hidden rounded-2xl border transition ${
              active === i ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/40"
            }`}
            aria-label={t("venuePage.photoOf", { n: i + 1 })}
          >
            <img src={p} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover md:aspect-[16/10]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationCard({ venue }: { venue: { name: string; address: string | null; area: string; lat: number | null; lng: number | null } }) {
  const { t } = useTranslation();
  const hasCoords = venue.lat != null && venue.lng != null;
  const directions = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
      <div className="border-b border-border/60 p-4">
        <h2 className="font-display text-lg font-semibold">{t("venuePage.location")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{venue.address ?? venue.area}</p>
      </div>
      <div className="aspect-[16/9] w-full bg-surface">
        {hasCoords ? (
          <GoogleMapView lat={Number(venue.lat)} lng={Number(venue.lng)} label={venue.name} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("venuePage.noCoords")}
          </div>
        )}
      </div>
      {directions && (
        <div className="border-t border-border/60 p-3 text-right">
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <MapPin className="h-4 w-4" /> {t("venuePage.directions")}
          </a>
        </div>
      )}
    </div>
  );
}

function AmenitiesCard({ amenities }: { amenities: string[] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <h2 className="font-display text-lg font-semibold">{t("venuePage.amenities")}</h2>
      {amenities.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("venuePage.noAmenities")}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {amenities.map((a) => {
            const { icon: Icon, label } = amenityMeta(a);
            return (
              <li key={a} className="flex items-center gap-2 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OpenGamesSection({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: games = [] } = useQuery({
    ...openGamesQuery(venueId),
    retry: false,
    // Only fetch when a user is signed in (endpoint requires auth).
    enabled: !!user,
  });

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">{t("venuePage.openGames")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("venuePage.openGamesDesc")}</p>
        </div>
        <span className="text-sm text-muted-foreground">{t("venuePage.openGamesActive", { count: games.length })}</span>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("venuePage.noOpenGames")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {games.map((g: any) => (
            <OpenGameCard key={g.id} game={g} venueId={venueId} />
          ))}
        </div>
      )}
    </section>
  );
}

function OpenGameCard({ game, venueId }: { game: OpenGameWithPlayers; venueId: string }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const join = useServerFn(joinOpenGame);
  const leave = useServerFn(leaveOpenGame);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => join({ data: { openGameId: game.id } }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["open-games", "venue", venueId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leave({ data: { openGameId: game.id } }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["open-games", "venue", venueId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const taken = game.players.length;
  const free = Math.max(game.max_players - taken, 0);
  const alreadyIn = user ? game.players.some((p) => p.player_id === user.id) : false;
  const isHost = user ? game.players.some((p) => p.player_id === user.id && p.is_host) : false;
  const isFull = free === 0;
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const dateLabel = new Date(game.date).toLocaleDateString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 font-medium">
              <Calendar className="h-4 w-4 text-primary" /> {dateLabel}
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <Clock className="h-4 w-4 text-primary" /> {game.start_time.slice(0, 5)}
            </span>
          </div>
          {game.level && (
            <span className="mt-2 inline-block rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              {t("venuePage.level")} · {t(`levels.${game.level}`, game.level)}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold">
            {taken}/{game.max_players}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("venuePage.players")}</div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {game.players.map((p) => (
          <li key={p.player_id} className="flex items-center gap-3">
            <div className="relative">
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {(p.full_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              {p.is_host && (
                <Crown className="absolute -right-1 -top-1 h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {p.full_name ?? t("openGames.player")} {p.is_host && <span className="text-[10px] uppercase text-primary">Host</span>}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.level ? t(`levels.${p.level}`, p.level) : "—"}
                {p.rating != null && (
                  <> · <Star className="inline h-3 w-3 fill-primary text-primary" /> {Number(p.rating).toFixed(1)}</>
                )}
              </div>
            </div>
          </li>
        ))}
        {Array.from({ length: free }).map((_, i) => (
          <li key={`free-${i}`} className="flex items-center gap-3 opacity-60">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
              ?
            </div>
            <div className="text-sm text-muted-foreground">{t("venuePage.emptySeat")}</div>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <div className="mt-4">
        {!user ? (
          <Link
            to="/auth"
            className="block w-full rounded-xl border border-border/60 px-4 py-2.5 text-center text-sm font-semibold hover:border-primary/50"
          >
            {t("venuePage.signInToJoin")}
          </Link>
        ) : alreadyIn ? (
          isHost ? (
            <button
              disabled
              className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary"
            >
              {t("venuePage.youAreHost")}
            </button>
          ) : (
            <button
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {leaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("venuePage.leave")}
            </button>
          )
        ) : isFull ? (
          <button
            disabled
            className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground"
          >
            {t("venuePage.full")}
          </button>
        ) : (
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("venuePage.join")}
          </button>
        )}
      </div>
    </div>
  );
}
