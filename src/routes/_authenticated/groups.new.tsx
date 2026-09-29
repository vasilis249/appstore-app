import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { GroupForm } from "@/components/groups/group-form";
import { rpcErrorKey } from "@/lib/friends";
import { createGroup, groupKeys } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroupPage,
});

function NewGroupPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: createGroup,
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      toast.success(t("groups.created"));
      void navigate({ to: "/g/$groupId", params: { groupId: id }, replace: true });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  return (
    <>
      <AppHeader back title={t("groups.new")} />
      <GroupForm submitLabel={t("groups.create")} busy={create.isPending} onSubmit={(v) => create.mutate(v)} />
    </>
  );
}
