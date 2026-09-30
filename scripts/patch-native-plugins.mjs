// Before `cap sync ios`: plugins whose Swift package pins an older Capacitor major, patched to accept ours (8.x).
// @capacitor-community/background-geolocation 1.2.26 declares capacitor-swift-pm `from: "7.0.0"` (= 7.x only in SPM),
// which can't resolve next to the app's exact 8.5.2. The Swift code itself works with Capacitor 8. Idempotent.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const patches = [
  {
    file: "node_modules/@capacitor-community/background-geolocation/Package.swift",
    from: /capacitor-swift-pm\.git",\s*from:\s*"7\.0\.0"/,
    to: 'capacitor-swift-pm.git",\n            from: "8.0.0"',
  },
];

for (const p of patches) {
  if (!existsSync(p.file)) continue;
  const src = readFileSync(p.file, "utf8");
  if (!p.from.test(src)) continue;
  writeFileSync(p.file, src.replace(p.from, p.to));
  console.log(`patched ${p.file}`);
}
