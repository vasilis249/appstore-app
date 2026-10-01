import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** The five tab roots: moving between them cross-fades; anything deeper slides in like a pushed screen. */
const TABS = new Set(["/", "/map", "/messages", "/search", "/profile"]);
const depth = (path: string) => (TABS.has(path) ? 0 : path.split("/").filter(Boolean).length);

/** View-transition type for a navigation (styled in design-system.css): tab | push | pop. */
function transitionTypes({ fromLocation, toLocation, pathChanged }: { fromLocation?: { pathname: string }; toLocation: { pathname: string }; pathChanged: boolean }) {
  if (!pathChanged || !fromLocation) return false;
  const a = depth(fromLocation.pathname), b = depth(toLocation.pathname);
  if (a === 0 && b === 0) return ["tab"];
  return [b >= a ? "push" : "pop"];
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Preload routes on hover/touch for instant-feeling navigation, and animate page changes with the native
    // View Transitions API like a social app: tabs cross-fade, deeper screens slide (ignored where unsupported).
    defaultPreload: "intent",
    defaultViewTransition: { types: transitionTypes },
  });

  return router;
};
