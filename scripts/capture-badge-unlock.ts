import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";

const ART = "/opt/cursor/artifacts";
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3114";

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordMp4(page: Page, dest: string, ms = 4000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unlock-frames-"));
  const interval = 1000 / 30;
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < ms) {
    const frameStart = Date.now();
    await page.screenshot({
      path: path.join(dir, `${String(i).padStart(4, "0")}.jpg`),
      type: "jpeg",
      quality: 72,
    });
    i += 1;
    const used = Date.now() - frameStart;
    if (used < interval) await delay(interval - used);
  }
  execSync(
    `ffmpeg -y -framerate 30 -i ${dir}/%04d.jpg -c:v libx264 -pix_fmt yuv420p -r 30 -crf 23 -movflags +faststart -t 4 "${dest}"`,
    { stdio: "inherit" },
  );
  fs.rmSync(dir, { recursive: true, force: true });
}

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

  const styles = [
    { id: "medal", shot: "unlock2_a_medal.png", video: "unlock2_a_medal.mp4" },
    { id: "belt", shot: "unlock2_b_belt.png", video: "unlock2_b_belt.mp4" },
    { id: "hex", shot: "unlock2_c_hex.png", video: "unlock2_c_hex.mp4" },
  ] as const;

  for (const style of styles) {
    const url = `${BASE}/progress?unlock=streak_7&unlockPreview=1&badgeStyle=${style.id}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.waitForSelector("[data-badge-unlock='1']", { timeout: 15_000 });
    await delay(380);
    await page.screenshot({ path: path.join(ART, style.shot), type: "png" });
    console.log("wrote", style.shot);

    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.waitForSelector("[data-badge-unlock='1']", { timeout: 15_000 });
    await recordMp4(page, path.join(ART, style.video), 4000);
    console.log("wrote", style.video);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
