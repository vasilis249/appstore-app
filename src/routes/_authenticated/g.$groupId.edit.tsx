import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { GroupForm } from "@/components/groups/group-form";
import { rpcErrorKey } from "@/lib/friends";
import { groupDetail, groupKeys, updateGroup, type GroupPrivacy } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/g/$groupId/edit")({
  component: EditGroupPage,
});

/** Admins: name, description, category, public / private. */
function EditGroupPage() {
  const { groupId } = Route.useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const g = useQuery({ queryKey: groupKeys.detail(groupId), queryFn: () => groupDetail(groupId) });
  const save = useMutation({
    mutationFn: (v: { name: string; description: string; section: string; privacy: GroupPrivacy }) => updateGroup(groupId, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      toast.success(t("groups.saved"));
      void navigate({ to: "/g/$groupId", params: { groupId }, replace: true });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const d = g.data;
  if (g.data === null || (d && d.my_role !== "owner" && d.my_role !== "admin")) return <Navigate to="/g/$groupId" params={{ groupId }} replace />;
  return (
    <>
      <AppHeader back title={t("groups.edit")} />
      {d && (
        <GroupForm
          initial={{ name: d.name, description: d.description, section: d.section_id, privacy: d.privacy }}
          submitLabel={t("common.save")}
          busy={save.isPending}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
    </>
  );
}
