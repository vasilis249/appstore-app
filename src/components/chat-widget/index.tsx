import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  listConversations,
  type ConversationListItem,
} from "@/lib/api/community.functions";

import { ChatWidgetProvider, useChatWidget } from "./context";
import { ChatWindowsLayer, ConversationsPanel } from "./chat-window";

export function ChatWidget() {
  const { user, role, loading } = useAuth();
  const isPlayer = !loading && !!user && role === "player";
  if (!isPlayer) return null;
  return (
    <ChatWidgetProvider>
      <ChatWidgetInner userId={user!.id} />
    </ChatWidgetProvider>
  );
}

function ChatWidgetInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { panelOpen, togglePanel, openIds, openConversation } = useChatWidget();
  const listFn = useServerFn(listConversations);
  const lastToastAtRef = useRef<number>(0);

  const conversations = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: () => listFn(),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const items: ConversationListItem[] = conversations.data ?? [];
  const totalUnread = items.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  useEffect(() => {
    const channel = supabase
      .channel("messages-fab")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            sender_id: string | null;
            conversation_id: string;
          };
          if (!row || row.sender_id === userId) return;
          await qc.invalidateQueries({ queryKey: ["messages", "conversations"] });

          // If a window is open for this conv, the window handles its own thread cache.
          // Show a toast (throttled) unless that conversation is the front-most open window.
          const isFrontOpen = openIds[0] === row.conversation_id;
          if (isFrontOpen) return;

          const now = Date.now();
          if (now - lastToastAtRef.current < 1500) return;
          lastToastAtRef.current = now;

          const cached = qc.getQueryData<ConversationListItem[]>([
            "messages",
            "conversations",
          ]);
          const conv = (cached ?? items).find((c) => c.id === row.conversation_id);
          const senderName = conv?.other_full_name ?? null;
          const label = senderName
            ? t("community.newMessageFrom", { name: senderName })
            : t("community.newMessage");

          toast(label, {
            position: "bottom-right",
            action: {
              label: t("community.open"),
              onClick: () => openConversation(row.conversation_id),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc, t, items, openIds, openConversation]);

  const showBadge = totalUnread > 0;
  const showCount = totalUnread > 0 && totalUnread <= 9;

  return (
    <>
      <ChatWindowsLayer userId={userId} isMobile={isMobile} />
      {panelOpen && (
        <ConversationsPanel
          conversations={items}
          loading={conversations.isLoading}
          isMobile={isMobile}
        />
      )}
      <button
        type="button"
        onClick={togglePanel}
        aria-label={t("community.messages.openMessages")}
        aria-expanded={panelOpen}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] right-4 z-50 hidden h-14 w-14 md:inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 md:bottom-6 md:right-6"
      >
        <MessageCircle className="h-6 w-6" />
        {showBadge ? (
          showCount ? (
            <span
              aria-label={t("community.unreadAria", { count: totalUnread })}
              className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background"
            >
              {totalUnread}
            </span>
          ) : (
            <span
              aria-label={t("community.unreadAria", { count: totalUnread })}
              className="absolute right-0 top-0 h-3 w-3 rounded-full bg-destructive ring-2 ring-background"
            />
          )
        ) : null}
      </button>
    </>
  );
}
