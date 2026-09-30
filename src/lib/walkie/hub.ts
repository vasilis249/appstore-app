import { silenceAll } from "@/lib/audio";
import { WalkieSession, walkieAudioRunning, type WalkieSnapshot } from "./engine";

/**
 * Every live walkie session of this device, one per friend. "Channel on" friends are kept connected while you use
 * the rest of the app (you hear them anywhere, they see you as here); a friend's walkie screen borrows the same
 * session, so there is never a second join of the same channel.
 */

interface Entry {
  session: WalkieSession;
  refs: number;
  pinned: boolean;
  off: (() => void)[];
}

export interface HubPeer {
  peer: string;
  snap: WalkieSnapshot;
}

let me: string | null = null;
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const startListeners = new Set<(peer: string) => void>();
let version = 0;

function changed() {
  version++;
  listeners.forEach((fn) => fn());
}

function open(peer: string): Entry {
  let e = entries.get(peer);
  if (e) return e;
  const session = new WalkieSession(me!, peer);
  e = { session, refs: 0, pinned: false, off: [] };
  e.off.push(session.subscribe(changed));
  e.off.push(
    session.on("peerStart", () => {
      // An incoming voice interrupts the podcast queue / clips, like a call.
      if (walkieAudioRunning()) silenceAll();
      startListeners.forEach((fn) => fn(peer));
    }),
  );
  entries.set(peer, e);
  session.connect();
  changed();
  return e;
}

function closeIfUnused(peer: string) {
  const e = entries.get(peer);
  if (!e || e.refs > 0 || e.pinned) return;
  e.off.forEach((f) => f());
  e.session.dispose();
  entries.delete(peer);
  changed();
}

export const walkieHub = {
  /** Signed-in user (null on sign-out closes everything). */
  setUser(id: string | null) {
    if (id === me) return;
    for (const [peer, e] of entries) {
      e.off.forEach((f) => f());
      e.session.dispose();
      entries.delete(peer);
    }
    me = id;
    changed();
  },

  /** Friends whose channel stays open (walkie_list → channel_on). */
  setPinned(peers: string[]) {
    if (!me) return;
    const want = new Set(peers);
    for (const [peer, e] of entries) {
      if (e.pinned && !want.has(peer)) {
        e.pinned = false;
        closeIfUnused(peer);
      }
    }
    for (const peer of want) open(peer).pinned = true;
  },

  /** A screen uses this friend's session until it calls the returned release. */
  acquire(peer: string): { session: WalkieSession; release: () => void } | null {
    if (!me || peer === me) return null;
    const e = open(peer);
    e.refs++;
    let released = false;
    return {
      session: e.session,
      release: () => {
        if (released) return;
        released = true;
        e.refs--;
        // Let a quick remount (route change, StrictMode) reuse the connection.
        setTimeout(() => closeIfUnused(peer), 1500);
      },
    };
  },

  /** Every open session (for the "… is talking" banner). */
  peers(): HubPeer[] {
    return [...entries.entries()].map(([peer, e]) => ({ peer, snap: e.session.snapshot }));
  },

  /** Back in the foreground / online again: rejoin whatever is not connected. */
  refresh() {
    for (const e of entries.values()) if (!e.session.snapshot.connected) e.session.reconnect();
  },

  pinnedCount(): number {
    return [...entries.values()].filter((e) => e.pinned).length;
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },

  /** A friend started talking on any open session. */
  onPeerStart(fn: (peer: string) => void): () => void {
    startListeners.add(fn);
    return () => void startListeners.delete(fn);
  },

  /** Changes on every change (useSyncExternalStore). */
  version: () => version,
};
