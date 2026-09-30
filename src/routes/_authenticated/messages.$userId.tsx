import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, RadioTower } from "lucide-react";
import { HeaderPill } from "@/components/app-header";
import { PersonActionsSheet } from "@/components/friends/person-actions-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { UserAvatar } from "@/components/user-avatar";
import { RecordBar } from "@/components/voice/record-bar";
import { VoiceBubble } from "@/components/voice/voice-bubble";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys, profileStats, rpcErrorKey } from "@/lib/friends";
import { DM_MAX_MS, listThread, sendVoice, voiceKeys } from "@/lib/voice";

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { userId } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const bottom = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);

  const other = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_path")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const friends = useQuery({ queryKey: friendKeys.stats(userId), queryFn: () => profileStats(userId) });
  const isFriend = !!friends.data?.i_follow && !!friends.data?.follows_me;
  const messages = useQuery({
    queryKey: voiceKeys.thread(userId),
    queryFn: () => listThread(user!.id, userId),
    enabled: !!user,
  });

  const count = messages.data?.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const name = other.data ? other.data.full_name || other.data.username : "";
  // "Report" in a conversation points at their latest voice message (the audio itself may be gone).
  const lastIncoming = [...(messages.data ?? [])].reverse().find((m) => m.sender_id === userId);

  return (
    <>
      <AppHeader
        back
        right={
          other.data && (
            <HeaderPill>
              {isFriend && (
                <Link to="/talk/$userId" params={{ userId }} aria-label={t("walkie.title")} className="grid h-9 w-10 place-items-center rounded-full">
                  <RadioTower className="h-5 w-5" />
                </Link>
              )}
              <button type="button" onClick={() => setMenu(true)} aria-label={t("friends.actions")} className="grid h-9 w-10 place-items-center rounded-full">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </HeaderPill>
          )
        }
        center={
          other.data && (
            <span className="flex min-w-0 max-w-[60vw] items-center gap-2">
              <UserAvatar name={name} path={other.data.avatar_path} size={32} />
              <span className="truncate font-semibold">{name}</span>
            </span>
          )
        }
      />
      <div className="flex flex-1 flex-col gap-3 px-4 pb-32 pt-2">
        {messages.data && !messages.data.length && (
          <p className="py-16 text-center text-caption text-muted-foreground">{t("voice.threadEmpty")}</p>
        )}
        {(messages.data ?? []).map((m) => (
          <VoiceBubble key={m.id} msg={m} mine={m.sender_id === user?.id} />
        ))}
        <div ref={bottom} />
      </div>
      <PersonActionsSheet
        person={menu && other.data ? other.data : null}
        report={lastIncoming ? { kind: "voice_message", id: lastIncoming.id, label: t("report.conversation") } : undefined}
        onOpenChange={setMenu}
        onBlocked={() => void navigate({ to: "/messages" })}
      />
      {friends.data && !isFriend ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-border bg-background/95 py-5 text-center text-caption text-muted-foreground">
          {t("voice.friendsOnly")}
        </div>
      ) : (
        <RecordBar
          maxMs={DM_MAX_MS}
          disabled={!friends.data}
          onSend={async (clip) => {
            try {
              await sendVoice(userId, clip);
              void qc.invalidateQueries({ queryKey: voiceKeys.all });
            } catch (e) {
              toast.error(t(rpcErrorKey(e)));
              throw e;
            }
          }}
        />
      )}
    </>
  );
}
