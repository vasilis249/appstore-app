import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import appCss from "../styles.css?url";
import { hydrateLanguage } from "../i18n";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "../components/bottom-nav";
import { RealtimeSync } from "../components/realtime-sync";
import { DailyPromptScheduler } from "../components/daily-prompt-scheduler";
import { InviteClaimer } from "../components/invite-claimer";
import { WalkieBanner, WalkieHubSync } from "../components/walkie/walkie-hub";
import { LocationSync } from "../components/location/location-sync";
import { MiniPlayer } from "../components/posts/mini-player";
import { AUTH_PATHS } from "../components/bottom-nav";
import { useQueue } from "../lib/queue";
import { useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "../components/offline-banner";
import { initNativeShell } from "../lib/native";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-semibold text-primary">404</h1>
        <h2 className="mt-4 text-tagline font-semibold">{t("errors.notFoundTitle")}</h2>
        <p className="mt-2 text-caption text-muted-foreground">{t("errors.notFoundDesc")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-caption font-normal text-primary-foreground transition-colors hover:opacity-90"
          >
            {t("errors.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-tagline font-semibold">{t("errors.generic")}</h1>
        <p className="mt-2 text-caption text-muted-foreground">{t("errors.tryAgainOrHome")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-caption font-normal text-primary-foreground"
          >
            {t("errors.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-2.5 text-caption font-normal"
          >
            {t("errors.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      // Follows the iPhone's Light / Dark setting (DESIGN.md: Apple parchment / black).
      { name: "theme-color", content: "#f5f5f7", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#000000", media: "(prefers-color-scheme: dark)" },
      { name: "color-scheme", content: "light dark" },
      { title: "Speak — Πες τη γνώμη σου με φωνή" },
      {
        name: "description",
        content: "Το κοινωνικό δίκτυο της φωνής: πες τη γνώμη σου για ό,τι συμβαίνει, σε 2 λεπτά.",
      },
      { name: "author", content: "Speak" },
      { property: "og:title", content: "Speak" },
      {
        property: "og:description",
        content: "Το κοινωνικό δίκτυο της φωνής: πες τη γνώμη σου για ό,τι συμβαίνει, σε 2 λεπτά.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href:
          "data:image/svg+xml;utf8," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5.5" fill="#0066CC"/><g transform="translate(4.2 4.2) scale(0.65)" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"><line x1="2" x2="2" y1="12" y2="12"/><line x1="4" x2="4" y1="10.2" y2="13.8"/><line x1="6" x2="6" y1="8" y2="16"/><line x1="8" x2="8" y1="3" y2="21"/><line x1="10" x2="10" y1="6.5" y2="17.5"/><line x1="12" x2="12" y1="8.4" y2="15.6"/><line x1="14" x2="14" y1="6.5" y2="17.5"/><line x1="16" x2="16" y1="3" y2="21"/><line x1="18" x2="18" y1="8" y2="16"/><line x1="20" x2="20" y1="10.2" y2="13.8"/><line x1="22" x2="22" y1="12" y2="12"/></g></svg>',
          ),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="el" style={{ colorScheme: "light dark" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const queue = useQueue();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Screens with their own bottom controls hide the nav (conversation, sign-in steps) or the player (composer).
  const navShown = !/^\/(messages|talk)\/./.test(path) && !AUTH_PATHS.test(path) && path !== "/student";
  const playerShown = queue.index >= 0 && navShown && path !== "/record";

  useEffect(() => {
    hydrateLanguage();
  }, []);
  useEffect(() => {
    void initNativeShell();
  }, []);

  useEffect(() => {
    let mounted = true;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (!mounted) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      return () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={
          "min-h-screen flex flex-col " +
          (playerShown ? "pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]" : "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]")
        }
      >
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Outlet />
        </main>
        <BottomNav />
        {playerShown && <MiniPlayer lifted />}
        <RealtimeSync />
        <DailyPromptScheduler />
        <InviteClaimer />
        <WalkieHubSync />
        <LocationSync />
        <WalkieBanner />
        <OfflineBanner />
        {/* Below the header (its buttons stay tappable), clear of the floating nav; light / dark like the phone. */}
        <Toaster
          theme="system"
          position="top-center"
          offset={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
        />
      </div>
    </QueryClientProvider>
  );
}
