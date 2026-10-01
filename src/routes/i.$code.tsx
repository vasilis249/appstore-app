import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { GraduationCap } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Wordmark } from "@/components/wordmark";
import { useAuth } from "@/hooks/use-auth";
import { invitePreview } from "@/lib/api/invite.functions";
import { claimRememberedInvite, rememberInvite } from "@/lib/invites";

export const Route = createFileRoute("/i/$code")({
  head: () => ({ meta: [{ title: "Πρόσκληση — Speak" }, { name: "robots", content: "noindex" }] }),
  component: InvitePage,
});

/** Public invite page: who invites you, then sign up (the invite is claimed once you have an account). */
function InvitePage() {
  const { code } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const preview = useServerFn(invitePreview);
  const who = useQuery({ queryKey: ["invite", code], queryFn: () => preview({ data: { code } }), retry: false });

  useEffect(() => {
    if (/^[a-z0-9]{8}$/i.test(code)) rememberInvite(code.toLowerCase());
  }, [code]);

  // Already signed in: claim now (only works for new accounts) and go home.
  async function goOn() {
    await claimRememberedInvite();
    void navigate({ to: "/", replace: true });
  }

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pb-10 pt-10 text-center">
      <Wordmark className="text-hero" />
      <div className="flex flex-1 flex-col items-center justify-center">
        {who.data ? (
          <>
            <UserAvatar name={who.data.name} path={who.data.avatar_path} size={96} />
            <h1 className="mt-5 text-display font-semibold">{who.data.name}</h1>
            <p className="text-body text-muted-foreground">{t("invite.invitesYou")}</p>
            {who.data.school && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-caption font-semibold">
                <GraduationCap className="h-4 w-4" /> {who.data.school}
              </p>
            )}
            <p className="mt-4 text-callout text-muted-foreground">{t("invite.pageText")}</p>
          </>
        ) : who.isFetched ? (
          <>
            <h1 className="text-display font-semibold">{t("invite.genericTitle")}</h1>
            <p className="mt-4 text-callout text-muted-foreground">{t("invite.pageText")}</p>
          </>
        ) : null}
      </div>
      {user ? (
        <button type="button" onClick={() => void goOn()} className="h-14 w-full rounded-xl bg-primary text-body font-semibold text-primary-foreground">
          {t("auth.continue")}
        </button>
      ) : (
        <>
          <Link to="/auth" search={{ mode: "signup" }} className="grid h-14 w-full place-items-center rounded-xl bg-primary text-body font-semibold text-primary-foreground">
            {t("invite.join")}
          </Link>
          <Link to="/auth" search={{ mode: "signin" }} className="mt-4 text-callout font-semibold text-muted-foreground">
            {t("invite.haveAccount")}
          </Link>
        </>
      )}
    </main>
  );
}
