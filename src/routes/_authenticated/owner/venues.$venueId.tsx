import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Save, Trash2, Upload, Check, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  getOwnerVenueDetail,
  updateVenue,
  listVenuePhotos,
  registerVenuePhoto,
  deleteVenuePhoto,
  setVenueCover,
  setCourtsCount,
} from "@/lib/api/owner-management.functions";

import { AMENITIES } from "@/lib/amenities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleMapPicker, type PickedPlace } from "@/components/google-map-picker";
import { EquipmentManager } from "@/components/owner/equipment-manager";
import { playersFor, deriveSlotPrice, deriveBasePrice, type Sport } from "@/lib/sports";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/venues/$venueId")({
  head: () => ({ meta: [{ title: "Επεξεργασία γηπέδου — Courtsie" }] }),
  component: VenueEditPage,
});

function VenueEditPage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ["owner-venue", venueId],
    queryFn: () => getOwnerVenueDetail({ data: { venueId } }),
  });
  const photosQ = useQuery({
    queryKey: ["venue-photos", venueId],
    queryFn: () => listVenuePhotos({ data: { venueId } }),
  });

  const [form, setForm] = useState({
    name: "",
    area: "",
    address: "",
    basePricePerHour: 0,
    slotPrice: 0,
    amenities: [] as string[],
    photoUrl: "" as string,
    lat: null as number | null,
    lng: null as number | null,
    placeId: null as string | null,
    formattedAddress: null as string | null,
  });

  useEffect(() => {
    if (detailQ.data) {
      const d: any = detailQ.data;
      setForm({
        name: d.name,
        area: d.area ?? "",
        address: d.address ?? "",
        basePricePerHour: d.base_price_per_hour,
        slotPrice: Number(d.slot_price ?? 0),
        amenities: d.amenities,
        photoUrl: d.photo_url ?? "",
        lat: d.lat != null ? Number(d.lat) : null,
        lng: d.lng != null ? Number(d.lng) : null,
        placeId: d.place_id ?? null,
        formattedAddress: d.formatted_address ?? null,
      });
    }
  }, [detailQ.data]);

  const updateFn = useServerFn(updateVenue);
  const saveMut = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error(t("ownerVenueEdit.nameRequired", "Το όνομα είναι υποχρεωτικό"));
      if (!form.placeId || form.lat == null || form.lng == null) {
        throw new Error(t("ownerVenueEdit.pickLocation", "Επίλεξε έγκυρη τοποθεσία από τις προτάσεις"));
      }
      return updateFn({
        data: {
          venueId,
          name: form.name.trim(),
          area: form.area.trim() || null,
          address: (form.formattedAddress || form.address).trim() || null,
          basePricePerHour: form.basePricePerHour,
          slotPrice: form.slotPrice,
          amenities: form.amenities,
          photoUrl: form.photoUrl.trim() || null,
          lat: form.lat,
          lng: form.lng,
          placeId: form.placeId,
          formattedAddress: form.formattedAddress,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["owner-venue", venueId] });
      qc.invalidateQueries({ queryKey: ["owner-venues"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("common.error")),
  });


  const registerFn = useServerFn(registerVenuePhoto);
  const deletePhotoFn = useServerFn(deleteVenuePhoto);
  const setCoverFn = useServerFn(setVenueCover);
  const setCourtsCountFn = useServerFn(setCourtsCount);


  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t("ownerVenueEdit.tooLarge"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${venueId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("venue-photos")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      await registerFn({ data: { venueId, storagePath: path } });
      qc.invalidateQueries({ queryKey: ["venue-photos", venueId] });
      qc.invalidateQueries({ queryKey: ["owner-venue", venueId] });
      toast.success(t("ownerVenueEdit.uploadOk"));
    } catch (err: any) {
      toast.error(err.message ?? t("ownerVenueEdit.uploadFail"));
    } finally {
      setUploading(false);
    }
  }

  function toggleAmenity(slug: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(slug)
        ? f.amenities.filter((a) => a !== slug)
        : [...f.amenities, slug],
    }));
  }

  if (detailQ.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("ownerVenueEdit.loading")}</p>;
  }

  return (
    <div>
      <Link
        to="/owner/venues"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("ownerVenueEdit.back")}
      </Link>

      <h1 className="text-3xl font-bold">{t("ownerVenueEdit.title")}</h1>

      {detailQ.data && (() => {
        const d: any = detailQ.data;
        const status = d.approved ? "approved" : d.rejection_reason ? "rejected" : "pending";
        const cls = status === "approved"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
          : status === "rejected"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700";
        const label = status === "approved"
          ? t("ownerVenues.statusApproved", "Εγκεκριμένο — ορατό στους παίκτες")
          : status === "rejected"
            ? `${t("ownerVenues.statusRejected", "Απορρίφθηκε")}: ${d.rejection_reason}`
            : t("ownerVenues.statusPending", "Σε αναμονή έγκρισης από διαχειριστή");
        return (
          <div className={`mt-3 rounded-xl border px-4 py-2 text-sm ${cls}`}>{label}</div>
        );
      })()}



      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{t("ownerVenueEdit.details")}</h2>
          <div className="space-y-3">
            <Field label={t("ownerVenueEdit.name")}>
              <Input
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label={t("ownerVenueEdit.area")}>
              <Input
                value={form.area}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              />
            </Field>
            <Field label={t("ownerVenueEdit.address")}>
              <Textarea
                value={form.address}
                maxLength={240}
                rows={2}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>
            <Field label={t("ownerVenueEdit.mapLocation")}>
              <GoogleMapPicker
                initial={{
                  lat: form.lat,
                  lng: form.lng,
                  address: form.formattedAddress ?? form.address,
                  placeId: form.placeId,
                }}
                onChange={(p: PickedPlace) =>
                  setForm((f) => ({
                    ...f,
                    lat: p.lat,
                    lng: p.lng,
                    placeId: p.placeId,
                    formattedAddress: p.formattedAddress || f.formattedAddress,
                    address: p.formattedAddress || f.address,
                    area: p.area && !f.area ? p.area : f.area,
                  }))
                }
              />
            </Field>
            <Field label={t("ownerVenueEdit.basePrice")}>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={form.basePricePerHour || ""}
                onChange={(e) => {
                  const base = Number(e.target.value) || 0;
                  const sport: Sport = (detailQ.data as any)?.sport ?? "padel";
                  setForm((f) => ({
                    ...f,
                    basePricePerHour: base,
                    slotPrice: deriveSlotPrice(base, sport),
                  }));
                }}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("ownerVenues.wholeCourtHint")}
              </p>
            </Field>
            <Field label={t("ownerVenues.slotPrice")}>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={form.slotPrice || ""}
                onChange={(e) => {
                  const slot = Number(e.target.value) || 0;
                  const sport: Sport = (detailQ.data as any)?.sport ?? "padel";
                  setForm((f) => ({
                    ...f,
                    slotPrice: slot,
                    basePricePerHour: deriveBasePrice(slot, sport),
                  }));
                }}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {(() => {
                  const sport: Sport = (detailQ.data as any)?.sport ?? "padel";
                  return form.basePricePerHour > 0 && form.slotPrice > 0
                    ? t("ownerVenues.slotPriceAuto", { n: playersFor(sport) })
                    : t("ownerVenues.slotPriceManualSync", { n: playersFor(sport) });
                })()}
              </p>
            </Field>
            <Field label={t("ownerVenueEdit.courtsCount", "Αριθμός γηπέδων")}>
              <CourtsCountInput
                current={(detailQ.data as any)?.courts_count ?? 1}
                onSave={(n) =>
                  setCourtsCountFn({ data: { venueId, count: n } })
                    .then(() => {
                      qc.invalidateQueries({ queryKey: ["owner-venue", venueId] });
                      toast.success(t("common.saved"));
                    })
                    .catch((err: any) => toast.error(err.message ?? t("common.error")))
                }
              />
            </Field>
          </div>
        </div>




        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{t("ownerVenueEdit.amenities")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(AMENITIES).map(([slug, meta]) => {
              const on = form.amenities.includes(slug);
              const Icon = meta.icon;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleAmenity(slug)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                    on
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{meta.label}</span>
                  {on && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <EquipmentManager venueId={venueId} />
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("ownerVenueEdit.photos")}</h2>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? t("ownerVenueEdit.uploading") : t("ownerVenueEdit.upload")}
            </Button>
          </div>
        </div>

        {photosQ.data && photosQ.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 h-8 w-8" />
            {t("ownerVenueEdit.noPhotos")}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photosQ.data?.map((p) => {
            const isCover = form.photoUrl === p.url;
            return (
              <div
                key={p.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-surface",
                  isCover ? "border-primary ring-2 ring-primary/40" : "border-border/60",
                )}
              >
                <img
                  src={p.url}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                {isCover && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow">
                    {t("ownerVenueEdit.cover")}
                  </span>
                )}
                <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    disabled={isCover}
                    onClick={async () => {
                      try {
                        await setCoverFn({ data: { venueId, photoUrl: p.url } });
                        setForm((f) => ({ ...f, photoUrl: p.url }));
                        qc.invalidateQueries({ queryKey: ["owner-venue", venueId] });
                        toast.success(t("ownerVenueEdit.coverSet", "Ορίστηκε ως κύρια"));
                      } catch (e: any) {
                        toast.error(e.message ?? t("common.error"));
                      }
                    }}
                    className="flex-1 rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium backdrop-blur disabled:opacity-60"
                  >
                    {isCover ? t("ownerVenueEdit.cover") : t("ownerVenueEdit.setCover")}
                  </button>
                  <button
                    onClick={async () => {
                      await deletePhotoFn({ data: { photoId: p.id } });
                      if (isCover) setForm((f) => ({ ...f, photoUrl: "" }));
                      qc.invalidateQueries({ queryKey: ["venue-photos", venueId] });
                      qc.invalidateQueries({ queryKey: ["owner-venue", venueId] });
                    }}
                    className="rounded-md bg-destructive/80 px-2 py-1 text-[11px] font-medium text-destructive-foreground backdrop-blur"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          <Save className="mr-1 h-4 w-4" />
          {saveMut.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CourtsCountInput({
  current,
  onSave,
}: {
  current: number;
  onSave: (n: number) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [val, setVal] = useState<number>(current);
  useEffect(() => {
    setVal(current);
  }, [current]);
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        max={50}
        value={val}
        onChange={(e) => setVal(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
        onBlur={() => {
          if (val !== current) onSave(val);
        }}
      />
      <span className="text-xs text-muted-foreground">
        {t("ownerVenueEdit.autoSaveHint", "Saves automatically when it loses focus")}
      </span>
    </div>
  );
}
