import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Old chat URL; the Instagram-style inbox lives at /inbox.
export const Route = createFileRoute("/_authenticated/community_/messages")({
  validateSearch: z.object({ c: z.string().uuid().optional() }),
  beforeLoad: ({ search }) => {
    throw search.c
      ? redirect({ to: "/inbox/$conversationId", params: { conversationId: search.c } })
      : redirect({ to: "/inbox" });
  },
});
