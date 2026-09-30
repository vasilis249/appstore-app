import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteKeys, inviteUrl, myInvite } from "@/lib/invites";
import { cn } from "@/lib/utils";

/** "Invite friends" with your link (Web Share, else copy); how many joined through it. */
export function InviteShare({ className, text }: { className?: string; text?: string }) {
  const { t } = useTranslation();
  const inv = useQuery({ queryKey: inviteKeys.mine, queryFn: myInvite, staleTime: 60_000 });
  async function share() {
    if (!inv.data) return;
    const url = inviteUrl(inv.data.code);
    try {
      if (navigator.share) await navigator.share({ text: t("invite.shareText"), url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("invite.copied"));
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <button type="button" onClick={() => void share()} disabled={!inv.data} className={cn("flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <UserPlus className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{text ?? t("invite.title")}</span>
        <span className="block truncate text-fine text-muted-foreground">
          {inv.data?.joined ? t("invite.joined", { count: inv.data.joined }) : t("invite.hint")}
        </span>
      </span>
    </button>
  );
}
