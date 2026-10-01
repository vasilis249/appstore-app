import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Lock } from "lucide-react";
import { useSections } from "@/hooks/use-sections";
import type { GroupPrivacy } from "@/lib/groups";
import { cn } from "@/lib/utils";

export interface GroupFormValue {
  name: string;
  description: string;
  section: string;
  privacy: GroupPrivacy;
}

/** Name, what it's about, category, public / private — create and edit. */
export function GroupForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: GroupFormValue;
  submitLabel: string;
  busy: boolean;
  onSubmit: (v: GroupFormValue) => void;
}) {
  const { t } = useTranslation();
  const { sections, name: sectionName, icon } = useSections();
  const [v, setV] = useState<GroupFormValue>(initial ?? { name: "", description: "", section: "", privacy: "public" });
  const valid = v.name.trim().length >= 3 && !!v.section;
  const input = "w-full rounded-2xl bg-secondary px-4 text-body outline-none placeholder:text-muted-foreground";
  const label = "mb-2 block text-caption font-semibold";

  return (
    <form
      className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(v);
      }}
    >
      <label className="block">
        <span className={label}>{t("groups.name")}</span>
        <input value={v.name} maxLength={60} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={t("groups.namePlaceholder")} className={cn(input, "h-12")} />
      </label>
      <label className="block">
        <span className={label}>{t("groups.about")}</span>
        <textarea
          value={v.description}
          maxLength={300}
          rows={3}
          onChange={(e) => setV({ ...v, description: e.target.value })}
          placeholder={t("groups.aboutPlaceholder")}
          className={cn(input, "resize-none py-3")}
        />
      </label>
      <div>
        <span className={label}>{t("groups.category")}</span>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => {
            const Icon = icon(s);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={v.section === s.id}
                onClick={() => setV({ ...v, section: s.id })}
                className={cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold", v.section === s.id ? "bg-primary text-primary-foreground" : "bg-secondary")}
              >
                <Icon className="h-4 w-4" /> {sectionName(s.id)}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className={label}>{t("groups.privacy")}</span>
        <div className="space-y-2">
          {(["public", "private"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={v.privacy === p}
              onClick={() => setV({ ...v, privacy: p })}
              className={cn("flex w-full items-start gap-3 rounded-2xl p-4 text-left ring-1", v.privacy === p ? "bg-secondary ring-primary" : "ring-border")}
            >
              {p === "public" ? <Globe className="mt-0.5 h-5 w-5 shrink-0" /> : <Lock className="mt-0.5 h-5 w-5 shrink-0" />}
              <span>
                <span className="block font-semibold">{t(p === "public" ? "groups.public" : "groups.private")}</span>
                <span className="block text-caption text-muted-foreground">{t(p === "public" ? "groups.publicHint" : "groups.privateHint")}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <button type="submit" disabled={!valid || busy} className="mt-auto h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-40">
        {busy ? t("common.saving") : submitLabel}
      </button>
    </form>
  );
}
