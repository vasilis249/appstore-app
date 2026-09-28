import { createFileRoute, redirect } from "@tanstack/react-router";

// Friends were replaced by follows; people search lives in Explore.
export const Route = createFileRoute("/_authenticated/community")({
  beforeLoad: () => {
    throw redirect({ to: "/explore" });
  },
});
