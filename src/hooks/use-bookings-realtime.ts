import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on the `bookings` and `open_games` tables for
 * a given venue and invalidate any query whose key starts with one of the
 * provided keys (e.g. ["availability", venueId] or ["owner-schedule", venueId]).
 *
 * Call from a client component inside a hook — never at module scope.
 */
export function useBookingsRealtime(
  venueId: string | null | undefined,
  invalidateKeys: ReadonlyArray<ReadonlyArray<string>>,
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!venueId) return;
    const channel = supabase
      .channel(`bookings-${venueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `venue_id=eq.${venueId}` },
        () => {
          for (const key of invalidateKeys) {
            qc.invalidateQueries({ queryKey: key as string[] });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "open_games", filter: `venue_id=eq.${venueId}` },
        () => {
          for (const key of invalidateKeys) {
            qc.invalidateQueries({ queryKey: key as string[] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);
}
