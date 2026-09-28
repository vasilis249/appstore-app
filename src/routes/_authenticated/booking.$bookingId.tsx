import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink, Loader2, MapPin, Repeat, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { useRedirectOwnersAway } from "@/hooks/use-redirect-owners-away";
import {
  listMyBookings,
  cancelMyBooking,
  cancelMySeries,
  type MyBookingRow,
} from "@/lib/api/player-bookings.functions";
import { SPORTS } from "@/lib/sports";

export const Route = createFileRoute("/_authenticated/booking/$bookingId")({
  head: () => ({
    meta: [{ title: "Λεπτομέρειες κράτησης — Courtsie" }],
  }),
  component: BookingDetailPage,
});

function addHours(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function BookingDetailPage() {
  useRedirectOwnersAway();
  const { t, i18n } = useTranslation();
  const { bookingId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listMyBookings);
  const cancelFn = useServerFn(cancelMyBooking);
  const cancelSeriesFn = useServerFn(cancelMySeries);

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const cancelOne = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Η κράτηση ακυρώθηκε");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      navigate({ to: "/bookings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSeries = useMutation({
    mutationFn: (seriesId: string) => cancelSeriesFn({ data: { seriesId } }),
    onSuccess: () => {
      toast.success("Η σειρά κρατήσεων ακυρώθηκε");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      navigate({ to: "/bookings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const booking = (data ?? []).find((b) => b.id === bookingId);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-24">
      <Link
        to="/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("bookingDetail.back")}
      </Link>

      {isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση…
        </div>
      ) : !booking ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("bookingDetail.notFound")}</p>
          <Link
            to="/bookings"
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {t("bookingDetail.back")}
          </Link>
        </div>
      ) : (
        <BookingDetail
          booking={booking}
          locale={i18n.language === "el" ? "el-GR" : i18n.language}
          onCancel={() => {
            if (confirm(t("bookingDetail.confirmCancel"))) cancelOne.mutate(booking.id);
          }}
          onCancelSeries={() => {
            if (booking.series_id && confirm(t("bookingDetail.confirmCancelSeries")))
              cancelSeries.mutate(booking.series_id);
          }}
          cancelling={cancelOne.isPending || cancelSeries.isPending}
        />
      )}
    </div>
  );
}

function BookingDetail({
  booking,
  locale,
  onCancel,
  onCancelSeries,
  cancelling,
}: {
  booking: MyBookingRow;
  locale: string;
  onCancel: () => void;
  onCancelSeries: () => void;
  cancelling: boolean;
}) {
  const { t } = useTranslation();
  const sport = SPORTS.find((s) => s.id === booking.venue?.sport);
  const cancelled = booking.status === "cancelled";
  const todayIso = new Date().toISOString().slice(0, 10);
  const isFuture = !cancelled && booking.date >= todayIso;
  const end = addHours(booking.start_time, booking.duration_hours);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${booking.date}T12:00:00`));
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${booking.venue?.name ?? ""}, ${booking.venue?.area ?? ""}`,
  )}`;

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{t("bookingDetail.title")}</h1>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {sport && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sport.tokenClass}`}
            >
              {sport.id}
            </span>
          )}
          {booking.series_id && (
            <span className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-secondary">
              <Repeat className="h-3 w-3" /> Επαναλαμβανόμενη
            </span>
          )}
          {booking.type === "phone" && (
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold">
              Τηλεφωνική
            </span>
          )}
          {cancelled && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              Ακυρωμένη
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Ημερομηνία</div>
            <div className="mt-1 font-display text-lg font-semibold capitalize">{dateLabel}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Ώρα</div>
            <div className="mt-1 font-display text-lg font-semibold">
              {booking.start_time} – {end}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Γήπεδο</div>
            <div className="mt-1 text-sm font-semibold">{booking.venue?.name ?? "—"}</div>
            {booking.court_name && (
              <div className="text-xs text-muted-foreground">{booking.court_name}</div>
            )}
            {booking.venue?.area && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {booking.venue.area}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Τιμή</div>
            <div className="mt-1 font-display text-lg font-semibold">€{booking.price.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" /> {t("bookingDetail.directions")}
        </a>
        {booking.venue_id && (
          <Link
            to="/venues/$venueId"
            params={{ venueId: booking.venue_id }}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold hover:border-primary/40"
          >
            {t("bookingDetail.viewVenue")}
          </Link>
        )}
        {isFuture && (
          <>
            <button
              disabled={cancelling}
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> {t("bookingDetail.cancel")}
            </button>
            {booking.series_id && (
              <button
                disabled={cancelling}
                onClick={onCancelSeries}
                className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> {t("bookingDetail.cancelSeries")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
