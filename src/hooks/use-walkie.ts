import { useEffect, useRef, useState } from "react";
import { WalkieSession, type WalkieSnapshot } from "@/lib/walkie/engine";

/** A live walkie-talkie channel with one friend while the screen is open. */
export function useWalkie(me: string | undefined, peer: string, events: { onSaved?: () => void; onYield?: () => void } = {}) {
  const [snap, setSnap] = useState<WalkieSnapshot | null>(null);
  const session = useRef<WalkieSession | null>(null);
  const handlers = useRef(events);
  handlers.current = events;

  useEffect(() => {
    if (!me) return;
    const s = new WalkieSession(me, peer, {
      onChange: setSnap,
      onSaved: () => handlers.current.onSaved?.(),
      onYield: () => handlers.current.onYield?.(),
    });
    session.current = s;
    s.connect();
    return () => {
      s.dispose();
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
