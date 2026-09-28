import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  listOwnerEquipment,
  upsertEquipment,
  deleteEquipment,
  type EquipmentItem,
} from "@/lib/api/equipment.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EquipmentManager({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertEquipment);
  const deleteFn = useServerFn(deleteEquipment);

  const q = useQuery({
    queryKey: ["owner-equipment", venueId],
    queryFn: () => listOwnerEquipment({ data: { venueId } }),
  });

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["owner-equipment", venueId] });
    qc.invalidateQueries({ queryKey: ["venue-equipment", venueId] });
  };

  const addMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          venueId,
          name: name.trim(),
          price: Number(price) || 0,
          active: true,
          sortOrder: q.data?.length ?? 0,
        },
      }),
    onSuccess: () => {
      setName("");
      setPrice(0);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (item: EquipmentItem) =>
      upsertFn({
        data: {
          id: item.id,
          venueId,
          name: item.name,
          price: item.price,
          active: item.active,
          sortOrder: item.sort_order,
        },
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{t("equipment.title")}</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("equipment.subtitle")}</p>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("equipment.loading")}
        </div>
      ) : (
        <ul className="mb-4 space-y-2">
          {(q.data ?? []).length === 0 && (
            <li className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
              {t("equipment.empty")}
            </li>
          )}
          {(q.data ?? []).map((it) => (
            <EquipmentRow
              key={it.id}
              item={it}
              onSave={(patch) => updateMut.mutate({ ...it, ...patch })}
              onDelete={() => {
                if (confirm(t("equipment.deleteConfirm", { name: it.name }))) deleteMut.mutate(it.id);
              }}
              saving={updateMut.isPending}
            />
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
        <Input
          placeholder={t("equipment.namePh")}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          step="0.5"
          placeholder={t("equipment.pricePh")}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        <Button
          onClick={() => addMut.mutate()}
          disabled={!name.trim() || addMut.isPending}
        >
          {addMut.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          {t("equipment.add")}
        </Button>
      </div>
    </div>
  );
}

function EquipmentRow({
  item,
  onSave,
  onDelete,
  saving,
}: {
  item: EquipmentItem;
  onSave: (patch: Partial<EquipmentItem>) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);

  const dirty = name.trim() !== item.name || Number(price) !== item.price;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background p-2">
      <Input
        className="min-w-[160px] flex-1"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        className="w-28"
        type="number"
        min={0}
        step="0.5"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
      />
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={item.active}
          onChange={(e) => onSave({ active: e.target.checked })}
          className="h-3.5 w-3.5 accent-primary"
        />
        {t("equipment.active")}
      </label>
      {dirty && (
        <Button
          size="sm"
          variant="secondary"
          disabled={saving}
          onClick={() => onSave({ name: name.trim(), price: Number(price) || 0 })}
        >
          {t("equipment.save")}
        </Button>
      )}
      <button
        onClick={onDelete}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={t("equipment.delete")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
