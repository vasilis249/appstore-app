import { useEffect, useRef, useState } from "react";
import type { WalkieSession, WalkieSnapshot } from "@/lib/walkie/engine";
import { walkieHub } from "@/lib/walkie/hub";

/** The live walkie-talkie channel with one friend (shared with the hub when their channel is on). */
export function useWalkie(me: string | undefined, peer: string, events: { onSaved?: () => void; onYield?: () => void } = {}) {
  const [snap, setSnap] = useState<WalkieSnapshot | null>(null);
  const session = useRef<WalkieSession | null>(null);
  const handlers = useRef(events);
  handlers.current = events;

  useEffect(() => {
    if (!me) return;
    walkieHub.setUser(me); // no-op when the hub already runs for this user
    const got = walkieHub.acquire(peer);
    if (!got) return;
    const s = got.session;
    session.current = s;
    setSnap(s.snapshot);
    const off = [
      s.subscribe(setSnap),
      s.on("saved", () => handlers.current.onSaved?.()),
      s.on("yield", () => handlers.current.onYield?.()),
    ];
    return () => {
      off.forEach((f) => f());
      // Leaving the screen mid-transmission stops it (and saves what was said).
      s.release();
      got.release();
      session.current = null;
    };
  }, [me, peer]);

  return {
    snap,
    press: () => session.current?.press() ?? Promise.resolve(false),
    release: () => session.current?.release(),
    unlockAudio: () => void session.current?.unlockAudio(),
  };
}
