import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Preload routes on hover/touch for instant-feeling navigation, and use the
    // native View Transitions API for a smooth cross-fade between pages
    // (gracefully ignored by browsers that don't support it).
    defaultPreload: "intent",
    defaultViewTransition: true,
  });

  return router;
};
