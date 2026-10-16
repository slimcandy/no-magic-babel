// Makes the link-preview card (Open Graph, 1200×630) and the home-screen icon
// from the page itself. Run after `npm run build`, with Playwright installed:
//   npx vite preview --port 4173 & node scripts/share-card.mjs
// The screenshots are sRGB JPEG/PNG: link previews often drop colour profiles.
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:4173/";
const browser = await chromium.launch();

const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await card.goto(url);
await card.evaluate(() => document.fonts.ready);
await card.addStyleTag({
  content: `.topbar, .lead { display: none !important } .hero { min-height: 630px !important; padding-top: 4.5rem !important }
    .title { font-size: 4.6rem !important } .sun { animation: none !important }`,
});
await card.waitForTimeout(300);
await card.screenshot({ path: "site/public/share/card-1200x630.jpg", type: "jpeg", quality: 88, animations: "disabled" });

const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.goto(url);
await icon.evaluate(() => {
  const sprite = document.querySelector(".hero-sprite").outerHTML;
  document.body.innerHTML = `<div class="icon">${sprite}</div>`;
});
await icon.addStyleTag({
  content: `body { margin: 0; background: #140a24 } .icon { width: 180px; height: 180px; display: grid; place-items: center;
    background: linear-gradient(#140a24 55%, oklch(0.42 0.2 340)) } .hero-sprite { width: 112px !important; height: 128px !important }`,
});
await icon.screenshot({ path: "site/public/share/apple-touch-icon.png" });

await browser.close();
console.log("share card and icon written to site/public/share/");
