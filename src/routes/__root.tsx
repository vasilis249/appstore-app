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
import { MiniPlayer } from "../components/posts/mini-player";
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
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("errors.notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("errors.notFoundDesc")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
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
        <h1 className="text-xl font-semibold">{t("errors.generic")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("errors.tryAgainOrHome")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {t("errors.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-2.5 text-sm font-medium"
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
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="46" fill="#E4571C"/><rect x="37" y="82" width="18" height="36" rx="9" fill="#FFFFFF"/><rect x="64" y="65" width="18" height="70" rx="9" fill="#FFFFFF"/><rect x="91" y="48" width="18" height="104" rx="9" fill="#FFFFFF"/><rect x="118" y="65" width="18" height="70" rx="9" fill="#FFFFFF"/><rect x="145" y="82" width="18" height="36" rx="9" fill="#FFFFFF"/></svg>',
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
    <html lang="el" className="dark" style={{ colorScheme: "dark" }}>
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
  // Screens with their own bottom controls hide the nav (conversation) or the player (composer, conversation).
  const navShown = !/^\/messages\/./.test(path);
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
        <OfflineBanner />
        {/* Below the header (its buttons stay tappable), clear of the floating nav; dark like the app. */}
        <Toaster
          theme="dark"
          position="top-center"
          offset={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
        />
      </div>
    </QueryClientProvider>
  );
}
