import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listInbox } from "@/lib/api/inbox.functions";

/** Header shortcut to the inbox; badge = unread chats in Primary (requests don't count). */
export function MessagesButton({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listInbox);
  const q = useQuery({ queryKey: ["inbox"], queryFn: () => listFn(), staleTime: 15_000 });
  const unread = (q.data ?? []).filter((c) => c.accepted && c.unread > 0).length;

  // Any new message the user can see (RLS applies to realtime) refreshes the inbox.
  useEffect(() => {
    const ch = supabase
      .channel("inbox-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["inbox"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <Link
      to="/inbox"
      aria-label={t("dm.title")}
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
