import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import appCss from "../styles.css?url";
import { hydrateLanguage } from "../i18n";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "../components/bottom-nav";
import { TopBar } from "../components/top-bar";
import { Footer } from "../components/footer";
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
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t("errors.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("errors.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
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
      { title: "Courtsie — Κράτηση γηπέδων για padel, tennis, μπάσκετ & ποδόσφαιρο" },
      {
        name: "description",
        content:
          "Βρες και κλείσε γήπεδο σε δευτερόλεπτα. Padel, tennis, μπάσκετ και ποδόσφαιρο σε όλη την Ελλάδα.",
      },
      { name: "author", content: "Courtsie" },
      { property: "og:title", content: "Courtsie — Κράτηση γηπέδων" },
      {
        property: "og:description",
        content: "Padel, tennis, μπάσκετ & ποδόσφαιρο. Κράτηση σε δευτερόλεπτα.",
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
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="46" fill="#E4571C"/><path d="M141 68 A52 52 0 1 0 141 132" fill="none" stroke="#FFFFFF" stroke-width="19" stroke-linecap="round"/><circle cx="146.8" cy="100" r="20" fill="#FFFFFF"/><path d="M127.8 100 C 136.8 80 145.2 87.6 146.8 100 C 148.4 112.4 156.8 120 165.8 100" fill="none" stroke="#E4571C" stroke-width="4" stroke-linecap="round"/></svg>',
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
    <html lang="el">
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
      <div className="min-h-screen flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <TopBar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <BottomNav />
        <OfflineBanner />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
