import type { Clip } from "@/components/voice/voice-recorder";

// A voice recorded by holding the nav button, handed to /record (which picks it up once, on mount).
let pending: Clip | null = null;

export function setPendingClip(c: Clip) {
  pending = c;
}

export function takePendingClip(): Clip | null {
  const c = pending;
  pending = null;
  return c;
}
