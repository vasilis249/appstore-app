#!/bin/bash
# Browser flows against the local stack (Chromium + fake mic + realtime mock), each on a fresh seed.
#   bash tests/e2e/setup.sh            # once per container
#   bash tests/e2e/run.sh [port]       # builds, serves, runs; FLOWS="walkie walkie-ios" to pick
# Run before deploying any change to audio / walkie / push-to-talk code (src/lib/walkie, src/lib/audio.ts,
# src/hooks/use-recorder.ts, use-push-to-talk.ts): these flows caught every walkie regression so far.
S="$(cd "$(dirname "$0")" && pwd)"
P=${1:-8899}
bash "$S/local-build.sh" "$P" | tail -1
fail=0
for f in ${FLOWS:-walkie walkie-ios walkie-robust walkie-hub walkie-reconnect nearby micsession ptt}; do
  bash "$S/seed-speak.sh" >/dev/null 2>&1
  out=$(cd "$S" && timeout 400 node "$f-flow.mjs" "$P" 2>&1)
  p=$(grep -c '^PASS' <<<"$out"); x=$(grep -c '^FAIL' <<<"$out")
  echo "$f: pass=$p fail=$x"; grep -E '^FAIL' <<<"$out" | sed 's/^/    /'
  { [ "$x" -eq 0 ] && [ "$p" -gt 0 ]; } || fail=1
done
exit $fail
