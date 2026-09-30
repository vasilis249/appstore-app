import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, GraduationCap, Lock, MoreHorizontal } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { GroupActions } from "@/components/groups/join-button";
import { GroupMenuSheet } from "@/components/groups/group-menu-sheet";
import { GroupMeta, GroupTile } from "@/components/groups/group-row";
import { InviteSheet } from "@/components/groups/invite-sheet";
import { MembersList } from "@/components/groups/members-list";
import { RequestsSheet } from "@/components/groups/requests-sheet";
import { groupDetail, groupKeys } from "@/lib/groups";
import { cn } from "@/lib/utils";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { Segmented } from "@/components/segmented";

export const Route = createFileRoute("/_authenticated/g/$groupId/")({
  component: GroupPage,
});

/** A group: who it is for, your action (join / request / invite …), then its voices or its members. */
function GroupPage() {
  const { groupId } = Route.useParams();
  const { t } = useTranslation();
  const g = useQuery({ queryKey: groupKeys.detail(groupId), queryFn: () => groupDetail(groupId) });
  const [view, setView] = useState<"voices" | "members">("voices");
  const [menu, setMenu] = useState(false);
  const [invite, setInvite] = useState(false);
  const [requests, setRequests] = useState(false);
  const d = g.data;

  if (g.data === null)
    return (
      <>
        <AppHeader back />
        <EmptyState title={t("groups.notFound")} text={t("groups.notFoundText")} />
      </>
    );

  const canSee = !!d && (d.privacy === "public" || !!d.my_role);
  return (
    <>
      <AppHeader
        back
        title=" "
        right={
          d && (
            <button type="button" onClick={() => setMenu(true)} aria-label={t("friends.actions")} className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )
        }
      />
      {d && (
        <>
          <section className="space-y-4 px-4 pb-4">
            <div className="flex items-center gap-4">
              <GroupTile section={d.section_id} size={64} />
              <div className="min-w-0">
                <h1 className="text-display font-semibold leading-tight">{d.name}</h1>
                <GroupMeta privacy={d.privacy} members={d.members_count} section={d.auto ? undefined : d.section_id} />
                {d.auto && (
                  <p className="mt-0.5 flex items-center gap-1 text-caption font-normal text-link">
                    <GraduationCap className="h-3.5 w-3.5" /> {t("groups.autoGroup")}
                  </p>
                )}
              </div>
            </div>
            {d.description && <p className="whitespace-pre-line text-callout leading-snug text-foreground/90">{d.description}</p>}
            <GroupActions group={d} onInvite={() => setInvite(true)} />
            {d.pending_requests > 0 && (
              <button type="button" onClick={() => setRequests(true)} className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-callout font-semibold">
                <span>{t("groups.pendingRequests", { count: d.pending_requests })}</span>
                <span className="flex items-center gap-2">
                  <span className="min-w-5 rounded-full bg-badge px-1.5 text-center text-fine leading-5 text-destructive-foreground">{d.pending_requests}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
            )}
          </section>

          {canSee ? (
            <>
              <div className="border-t border-border px-4 pt-3">
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "voices", label: t("people.voices") },
                    { value: "members", label: t("groups.membersTab", { count: d.members_count }) },
                  ]}
                />
              </div>
              <div className="pt-2">
                {view === "voices" ? (
                  <FeedList
                    key={`group-${groupId}`}
                    params={{ scope: "group", group: groupId }}
                    empty={<EmptyState icon={VoiceIcon} text={t(d.my_role ? "groups.emptyVoicesMember" : "groups.emptyVoices")} />}
                  />
                ) : (
                  <MembersList groupId={groupId} myRole={d.my_role} />
                )}
              </div>
            </>
          ) : (
            <EmptyState icon={Lock} title={t("groups.privateTitle")} text={t(d.auto ? "groups.autoOnly" : "groups.privateText")} />
          )}

          <GroupMenuSheet group={d} open={menu} onOpenChange={setMenu} />
          {d.my_role && <InviteSheet groupId={groupId} open={invite} onOpenChange={setInvite} />}
          {/* Stays mounted for admins: unmounting it after the last approval left `requests` true, so the next
              request that came in popped the sheet open by itself. */}
          {(d.my_role === "owner" || d.my_role === "admin") && <RequestsSheet groupId={groupId} open={requests} onOpenChange={setRequests} />}
        </>
      )}
    </>
  );
}
