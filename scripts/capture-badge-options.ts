import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const ART = "/opt/cursor/artifacts";
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3112";

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--force-device-scale-factor=1",
      "--window-size=390,844",
    ],
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.type('input[name="email"]', "streaks@example.com");
  await page.type('input[name="password"]', "password12");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);

  async function shot(url: string, file: string, scrollSelector?: string) {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    if (scrollSelector) {
      await page.evaluate((selector) => {
        document.querySelector(selector)?.scrollIntoView({ block: "start" });
      }, scrollSelector);
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    const dest = path.join(ART, file);
    await page.screenshot({ path: dest, type: "png" });
    console.log("wrote", dest, "at", page.url());
  }

  await shot(`${BASE}/progress?badgeStyle=medal`, "badge_opt_a_medal.png", "#badges");
  await shot(`${BASE}/progress?badgeStyle=belt`, "badge_opt_b_belt.png", "#badges");
  await shot(`${BASE}/progress?badgeStyle=hex`, "badge_opt_c_hex.png", "#badges");
  await shot(`${BASE}/progress/badge-preview`, "badge_opt_compare.png", "#badge-compare");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
