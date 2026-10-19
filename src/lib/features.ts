/**
 * Features hidden for the launch (user decision 2026-10-15): no entry points while off, code kept for a later return.
 * Walkie back on (user request 2026-10-19); VITE_FEATURE_WALKIE=0 at build time hides it again.
 */
export const FEATURES = {
  walkie: import.meta.env.VITE_FEATURE_WALKIE !== "0",
  memories: false,
};
