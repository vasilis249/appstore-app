import { UserAvatar } from "@/components/social/user-avatar";
import type { InboxItem } from "@/lib/api/inbox.functions";

type ConvLike = Pick<InboxItem, "type" | "title" | "people">;

export function conversationName(c: ConvLike) {
  if (c.type === "group") return c.title ?? c.people.map((p) => p.username).join(", ");
  const p = c.people[0];
  return p ? (p.full_name ?? p.username) : "—";
}

export function ConversationAvatar({ c, size }: { c: ConvLike; size: number }) {
  const [a, b] = c.people;
  if (c.type === "group" && a && b) {
    const s = Math.round(size * 0.72);
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <span className="absolute left-0 top-0">
          <UserAvatar name={a.full_name ?? a.username} photoUrl={a.photo_url} size={s} />
        </span>
        <span className="absolute bottom-0 right-0 rounded-full ring-2 ring-background">
          <UserAvatar name={b.full_name ?? b.username} photoUrl={b.photo_url} size={s} />
        </span>
      </span>
    );
  }
  return (
    <UserAvatar
      name={a ? (a.full_name ?? a.username) : (c.title ?? "?")}
      photoUrl={a?.photo_url ?? null}
      size={size}
    />
  );
}
