// Renders the Speak logo into the iOS app icon and splash images.
// Usage (needs a Playwright Chromium; set CHROME_PATH if not the default):
//   node resources/render-assets.mjs resources/icon.png resources/splash.png
// then copy icon.png → ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
// and splash.png → the three files in ios/App/App/Assets.xcassets/Splash.imageset/.
import { chromium } from "playwright";
const [iconOut, splashOut] = process.argv.slice(2);
// Same mark as the favicon in src/routes/__root.tsx, full-bleed (iOS applies its own mask).
const mark = (bg) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  ${bg ? '<rect width="200" height="200" fill="#E4571C"/>' : ""}
  <path d="M141 68 A52 52 0 1 0 141 132" fill="none" stroke="#FFFFFF" stroke-width="19" stroke-linecap="round"/>
  <circle cx="146.8" cy="100" r="20" fill="#FFFFFF"/>
  <path d="M127.8 100 C 136.8 80 145.2 87.6 146.8 100 C 148.4 112.4 156.8 120 165.8 100" fill="none" stroke="#E4571C" stroke-width="4" stroke-linecap="round"/>
</svg>`;
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage();
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent(
  `<html><body style="margin:0;background:#E4571C">${mark(true)}</body></html>`,
);
await page.screenshot({ path: iconOut, omitBackground: false });
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent(`<html><body style="margin:0;background:#E4571C;display:grid;place-items:center;height:2732px">
  <div style="width:720px;height:720px">${mark(false)}</div></body></html>`);
await page.screenshot({ path: splashOut, omitBackground: false });
await browser.close();
