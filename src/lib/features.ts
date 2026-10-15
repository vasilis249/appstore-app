/**
 * Features hidden for the launch (user decision 2026-10-15): no entry points while off, code kept for a later return.
 * The e2e build turns the walkie on (VITE_FEATURE_WALKIE=1) so the shared audio engine stays tested.
 */
export const FEATURES = {
  walkie: import.meta.env.VITE_FEATURE_WALKIE === "1",
  memories: false,
};
