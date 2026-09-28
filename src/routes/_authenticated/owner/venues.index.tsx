import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, MapPin, Plus, Clock, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listOwnerVenues } from "@/lib/api/owner.functions";
import { createVenue, deleteVenue } from "@/lib/api/owner-management.functions";
import { playersFor, deriveSlotPrice, deriveBasePrice } from "@/lib/sports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleMapPicker, type PickedPlace } from "@/components/google-map-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


export const Route = createFileRoute("/_authenticated/owner/venues/")({
  head: () => ({ meta: [{ title: "Τα γήπεδά μου — Courtsie" }] }),
  component: VenuesIndex,
});

const SPORT_IDS = ["padel", "tennis", "basketball", "football", "volleyball", "beach_volley"] as const;
type SportId = (typeof SPORT_IDS)[number];

function VenuesIndex() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sport: "padel" as SportId,
    area: "",
    courtsCount: 1,
    basePricePerHour: 0,
    slotPrice: 0,
    lat: null as number | null,
    lng: null as number | null,
    placeId: null as string | null,
    formattedAddress: "" as string,
  });

  const venuesQ = useQuery({
    queryKey: ["owner-venues"],
    queryFn: () => listOwnerVenues(),
  });

  const createFn = useServerFn(createVenue);
  const createMut = useMutation({
    mutationFn: () => {
      if (!form.placeId || form.lat == null || form.lng == null || !form.formattedAddress) {
        throw new Error(t("ownerVenues.pickLocation", "Επίλεξε έγκυρη τοποθεσία από τις προτάσεις"));
      }
      return createFn({
        data: {
          name: form.name.trim(),
          sport: form.sport,
          area: form.area.trim(),
          address: form.formattedAddress,
          courtsCount: form.courtsCount,
          basePricePerHour: form.basePricePerHour,
          slotPrice: form.slotPrice,
          lat: form.lat,
          lng: form.lng,
          placeId: form.placeId,
          formattedAddress: form.formattedAddress,
        },
      });
    },
    onSuccess: ({ id, approved }) => {
      toast.success(approved ? t("ownerVenues.createdOk") : t("ownerVenues.pendingApproval", "Καταχωρήθηκε — σε αναμονή έγκρισης"));
      qc.invalidateQueries({ queryKey: ["owner-venues"] });
      setOpen(false);
      setForm({ name: "", sport: "padel", area: "", courtsCount: 1, basePricePerHour: 0, slotPrice: 0, lat: null, lng: null, placeId: null, formattedAddress: "" });
      navigate({ to: "/owner/venues/$venueId", params: { venueId: id } });
    },
    onError: (e: any) => toast.error(e.message ?? t("common.error")),
  });

  const deleteFn = useServerFn(deleteVenue);
  const deleteMut = useMutation({
    mutationFn: (venueId: string) => deleteFn({ data: { venueId } }),
    onSuccess: () => {
      toast.success(t("ownerVenues.deletedOk", "Το γήπεδο διαγράφηκε"));
      qc.invalidateQueries({ queryKey: ["owner-venues"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("common.error")),
  });


  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("ownerVenues.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("ownerVenues.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> {t("ownerVenues.add")}
        </Button>
      </div>

      <div className="mt-6 space-y-2">
        {venuesQ.isLoading && (
          <p className="text-sm text-muted-foreground">{t("ownerVenues.loading")}</p>
        )}
        {venuesQ.data?.length === 0 && (
          <button
            onClick={() => setOpen(true)}
            className="block w-full rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
          >
            <Plus className="mx-auto mb-2 h-6 w-6" />
            {t("ownerVenues.empty")}
          </button>
        )}
        {venuesQ.data?.map((v) => {
          const status = (v as any).approved
            ? "approved"
            : (v as any).rejection_reason
              ? "rejected"
              : "pending";
          const badge =
            status === "approved"
              ? { cls: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2, label: t("ownerVenues.statusApproved", "Εγκεκριμένο") }
              : status === "rejected"
                ? { cls: "bg-destructive/15 text-destructive", icon: XCircle, label: t("ownerVenues.statusRejected", "Απορρίφθηκε") }
                : { cls: "bg-amber-500/15 text-amber-700", icon: Clock, label: t("ownerVenues.statusPending", "Σε αναμονή έγκρισης") };
          const Icon = badge.icon;
          return (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40"
            >
              <Link
                to="/owner/venues/$venueId"
                params={{ venueId: v.id }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{v.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v.area} · {t(`sports.${v.sport}`, v.sport)}
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                  <Icon className="h-3 w-3" /> {badge.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("ownerVenues.deleteConfirm", `Να διαγραφεί το "${v.name}"; Η ενέργεια είναι μη αναστρέψιμη.`))) {
                      deleteMut.mutate(v.id);
                    }
                  }}
                  disabled={deleteMut.isPending}
                  className="rounded-lg border border-border/60 p-2 text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
                  title={t("ownerVenues.delete", "Διαγραφή")}
                  aria-label={t("ownerVenues.delete", "Διαγραφή")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          );
        })}

      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>{t("ownerVenues.newTitle")}</DialogTitle>
            <DialogDescription>{t("ownerVenues.newDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{t("ownerVenues.name")}</Label>
              <Input
                value={form.name}
                maxLength={120}
                placeholder={t("ownerVenues.namePh")}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{t("ownerVenues.sport")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SPORT_IDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      sport: s,
                      slotPrice: deriveSlotPrice(f.basePricePerHour, s),
                    }))}
                    className={
                      "rounded-xl border px-3 py-2 text-sm transition " +
                      (form.sport === s
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {t(`sports.${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{t("ownerVenues.area")}</Label>
              <Input
                value={form.area}
                maxLength={120}
                placeholder={t("ownerVenues.areaPh")}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                {t("ownerVenues.mapLocation", "Τοποθεσία")} *
              </Label>
              <GoogleMapPicker
                initial={{ lat: form.lat, lng: form.lng, address: form.formattedAddress, placeId: form.placeId }}
                onChange={(p: PickedPlace) =>
                  setForm((f) => ({
                    ...f,
                    lat: p.lat,
                    lng: p.lng,
                    placeId: p.placeId,
                    formattedAddress: p.formattedAddress,
                    area: f.area || p.area || "",
                  }))
                }
              />
              {!form.placeId && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("ownerVenues.pickLocationHint", "Επίλεξε διεύθυνση από τις προτάσεις του χάρτη")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{t("ownerVenues.courtsCount")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.courtsCount}
                  onChange={(e) => setForm((f) => ({ ...f, courtsCount: Math.max(1, Number(e.target.value)) }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  {t("ownerVenues.wholeCourtPrice")}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.basePricePerHour || ""}
                  onChange={(e) => {
                    const base = Number(e.target.value) || 0;
                    setForm((f) => ({
                      ...f,
                      basePricePerHour: base,
                      slotPrice: deriveSlotPrice(base, f.sport),
                    }));
                  }}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("ownerVenues.wholeCourtHint")}
                </p>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                {t("ownerVenues.slotPrice")}
              </Label>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={form.slotPrice || ""}
                onChange={(e) => {
                  const slot = Number(e.target.value) || 0;
                  setForm((f) => ({
                    ...f,
                    slotPrice: slot,
                    basePricePerHour: deriveBasePrice(slot, f.sport),
                  }));
                }}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {form.basePricePerHour > 0 && form.slotPrice > 0
                  ? t("ownerVenues.slotPriceAuto", { n: playersFor(form.sport) })
                  : t("ownerVenues.slotPriceManualSync", { n: playersFor(form.sport) })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || form.name.trim().length < 2 || form.area.trim().length < 2 || !form.placeId}
            >
              {createMut.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
