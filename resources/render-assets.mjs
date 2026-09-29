// Renders the iOS app icon (1024²) and splash (2732²) and copies them into the Xcode asset catalog.
// Usage (needs Playwright's Chromium; set CHROME_PATH if it is not the default one):
//   node resources/render-assets.mjs                      → placeholder mark (voice bars)
//   node resources/render-assets.mjs logo.svg             → your logo (SVG or PNG), centred with padding
//   node resources/render-assets.mjs logo.png --full      → your logo already designed as a full-bleed icon
//   options: --bg "#E4571C" (background colour behind the logo, also the splash colour)
// Writes resources/icon.png + resources/splash.png, then the files in ios/App/App/Assets.xcassets.
// iOS applies its own rounded mask to the icon, so never draw rounded corners yourself; no transparency.
import { chromium } from "playwright";
import { copyFileSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const args = process.argv.slice(2);
const logoPath = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--bg");
const full = args.includes("--full");
const bg = args.includes("--bg") ? args[args.indexOf("--bg") + 1] : "#E4571C";

// Placeholder until the real logo arrives: five rounded bars, like a voice level meter.
const placeholder = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  ${[[46, 36], [73, 70], [100, 104], [127, 70], [154, 36]]
    .map(([x, h]) => `<rect x="${x - 9}" y="${100 - h / 2}" width="18" height="${h}" rx="9" fill="#FFFFFF"/>`)
    .join("")}
</svg>`;

function logoHtml() {
  if (!logoPath) return placeholder;
  const file = resolve(logoPath);
  if (extname(file).toLowerCase() === ".svg") return readFileSync(file, "utf8").replace("<svg", '<svg width="100%" height="100%"');
  const b64 = readFileSync(file).toString("base64");
  return `<img src="data:image/png;base64,${b64}" style="width:100%;height:100%;object-fit:contain" />`;
}

const box = (size, inner) => `<html><body style="margin:0;background:${bg};display:grid;place-items:center;height:${size}px">
  <div style="width:${inner}px;height:${inner}px;display:grid;place-items:center">${logoHtml()}</div></body></html>`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent(box(1024, full ? 1024 : logoPath ? 640 : 1024));
await page.screenshot({ path: "resources/icon.png", omitBackground: false });
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent(box(2732, 640));
await page.screenshot({ path: "resources/splash.png", omitBackground: false });
await browser.close();

const assets = "ios/App/App/Assets.xcassets";
copyFileSync("resources/icon.png", `${assets}/AppIcon.appiconset/AppIcon-512@2x.png`);
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  copyFileSync("resources/splash.png", `${assets}/Splash.imageset/${f}`);
}
console.log(`icon + splash written (background ${bg}); run \`bun run ios:sync\` and rebuild in Xcode.`);
