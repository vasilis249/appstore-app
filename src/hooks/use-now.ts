import { useEffect, useState } from "react";

/** Current time, re-rendering every `ms` (for countdowns and "time left" labels). */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "3h 12m" / "12m" style, via i18n keys time.hoursMinutes / time.minutes. */
export function splitDuration(ms: number): { h: number; m: number } {
  const total = Math.max(0, Math.ceil(ms / 60_000));
  return { h: Math.floor(total / 60), m: total % 60 };
}
