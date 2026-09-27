import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const ART = "/opt/cursor/artifacts";
const BASE = "http://localhost:3091";

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
  console.log("after login", page.url());

  async function shot(url: string, file: string) {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    console.log(file, page.url());
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((resolve) => setTimeout(resolve, 600));
    const dest = path.join(ART, file);
    await page.screenshot({ path: dest, type: "png" });
    console.log("wrote", dest, "at", page.url());
  }

  await shot(`${BASE}/progress`, "streaks_progress.png");
  await shot(`${BASE}/progress/streaks`, "streaks_badges.png");
  await page.evaluate(() => {
    document.getElementById("leaderboard")?.scrollIntoView({ block: "start" });
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await page.screenshot({ path: path.join(ART, "streaks_leaderboard.png"), type: "png" });
  console.log("wrote leaderboard", page.url());

  await shot(`${BASE}/progress/records`, "records_list.png");
  await shot(`${BASE}/progress/records/trap-bar-deadlift`, "records_chart.png");
  await shot(
    `${BASE}/progress/records?pr=${encodeURIComponent("180 kg × 3")}&prDetail=${encodeURIComponent("Trap bar deadlift · +7.5 kg on your last best · 25 Sep")}`,
    "records_newpr.png",
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
