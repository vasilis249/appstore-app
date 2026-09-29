import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listThreads, voiceKeys } from "@/lib/voice";

export function useThreads() {
  const { user } = useAuth();
  return useQuery({ queryKey: voiceKeys.threads, queryFn: listThreads, enabled: !!user });
}

/** Unheard voice messages across all threads (header badge). */
export function useUnheardCount(): number {
  const { data } = useThreads();
  return (data ?? []).reduce((n, t) => n + t.unheard, 0);
}
