import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { useSections } from "@/hooks/use-sections";
import type { GroupPrivacy } from "@/lib/groups";

/** The group's "picture": its category icon on a rounded tile. */
export function GroupTile({ section, size = 48 }: { section: string; size?: number }) {
  const { icon } = useSections();
  const Icon = icon(section);
  return (
    <span className="grid shrink-0 place-items-center rounded-2xl bg-secondary text-link" style={{ width: size, height: size }}>
      <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}

/** "🔒 Ιδιωτική · 12 μέλη" */
export function GroupMeta({ privacy, members, section }: { privacy: GroupPrivacy; members: number; section?: string }) {
  const { t } = useTranslation();
  const { name } = useSections();
  return (
    <span className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground">
      {privacy === "private" && <Lock className="h-3 w-3 shrink-0" />}
      <span className="truncate">
        {t(privacy === "private" ? "groups.private" : "groups.public")} · {t("groups.members", { count: members })}
        {section && ` · ${name(section)}`}
      </span>
    </span>
  );
}

export function GroupRow({
  group,
  children,
}: {
  group: { id: string; name: string; section_id: string; privacy: GroupPrivacy; members_count: number };
  children?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link to="/g/$groupId" params={{ groupId: group.id }} className="flex min-w-0 flex-1 items-center gap-3">
        <GroupTile section={group.section_id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-callout font-semibold">{group.name}</span>
          <GroupMeta privacy={group.privacy} members={group.members_count} section={group.section_id} />
        </span>
      </Link>
      {children && <span className="flex shrink-0 items-center gap-2">{children}</span>}
    </li>
  );
}
