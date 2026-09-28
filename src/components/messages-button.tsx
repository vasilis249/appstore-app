import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { listConversations } from "@/lib/api/community.functions";

/** Header shortcut to the inbox with an unread badge (phones; desktop keeps the chat bubble). */
export function MessagesButton({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const listFn = useServerFn(listConversations);
  // Same cache entry as the chat widget, so both stay in sync.
  const q = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });
  const unread = (q.data ?? []).reduce((n, c) => n + (c.unread_count ?? 0), 0);
  return (
    <Link
      to="/community/messages"
      aria-label={t("community.messages.openMessages")}
      className={`relative grid h-10 w-10 place-items-center rounded-xl text-foreground transition hover:bg-muted ${className}`}
    >
      <Send className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
