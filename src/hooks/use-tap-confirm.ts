import { useEffect, useState } from "react";

/**
 * "Tap again to confirm" without the slip: the second tap counts only after a short pause (so a double tap can never
 * delete), and the armed state goes back by itself after a few seconds. `key` tells apart several rows on one screen.
 */
export function useTapConfirm(delayMs = 600, resetMs = 4000) {
  const [armed, setArmed] = useState<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), resetMs);
    return () => clearTimeout(id);
  }, [armed, resetMs]);
  return {
    isArmed: (key = "") => armed?.key === key,
    tap: (run: () => void, key = "") => {
      if (armed?.key !== key) setArmed({ key, at: Date.now() });
      else if (Date.now() - armed.at >= delayMs) {
        setArmed(null);
        run();
      }
    },
    disarm: () => setArmed(null),
  };
}
