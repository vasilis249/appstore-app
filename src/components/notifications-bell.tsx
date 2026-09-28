import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listMyNotifications,
  markNotificationsRead,
  type NotificationRow,
} from "@/lib/api/owner-management.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

function isBookingNotification(n: NotificationRow): boolean {
  const d = (n.data ?? {}) as Record<string, unknown>;
  return !!d.booking_id || n.type === "open_game_join" || n.type === "open_game_leave";
}

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationsRead);

  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription — INSERT only, scoped to this user.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          toast(row.title, { description: row.body ?? undefined });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const unread = useMemo(() => (notifs ?? []).filter((n) => !n.read_at), [notifs]);

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next && unread.length) {
      const ids = unread.map((n) => n.id);
      markFn({ data: { ids } }).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
    }
  }

  async function handleNotificationClick(n: NotificationRow) {
    const d = (n.data ?? {}) as Record<string, unknown>;
    let bookingId: string | null = (d.booking_id as string) ?? null;
    if (
      !bookingId &&
      (n.type === "open_game_join" || n.type === "open_game_leave") &&
      d.open_game_id
    ) {
      const { data } = await supabase
        .from("open_games")
        .select("booking_id")
        .eq("id", d.open_game_id as string)
        .maybeSingle();
      bookingId = (data?.booking_id as string) ?? null;
    }
    if (!bookingId) return;
    setOpen(false);
    navigate({ to: "/booking/$bookingId", params: { bookingId } });
  }

  if (!user) return null;

  if (isMobile) {
    // Phones: full "Activity" page, like Instagram.
    return (
      <Link
        to="/notifications"
        aria-label={t("activity.title")}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition hover:bg-muted"
      >
        {unread.length ? (
          <BellRing className="h-5 w-5 text-primary" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unread.length > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Ειδοποιήσεις"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition hover:bg-muted"
        >
          {unread.length > 0 ? (
            <BellRing className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unread.length > 0 && (
            <span className="badge-pop absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-primary-foreground shadow-glow">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border/60 px-3 py-2 text-sm font-semibold">
          Ειδοποιήσεις
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(notifs ?? []).length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Καμία ειδοποίηση ακόμα.
            </li>
          )}
          {(notifs ?? []).map((n) => {
            const clickable = isBookingNotification(n);
            return (
              <li
                key={n.id}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => handleNotificationClick(n) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleNotificationClick(n);
                        }
                      }
                    : undefined
                }
                title={clickable ? "Άνοιγμα κράτησης" : undefined}
                className={cn(
                  "border-b border-border/40 px-3 py-2 text-sm",
                  !n.read_at && "bg-primary/5",
                  clickable && "cursor-pointer transition hover:bg-muted/50",
                )}
              >
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("el-GR")}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
