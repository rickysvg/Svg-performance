import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";

const ART = "/opt/cursor/artifacts";
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3118";

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
  const elapsedSec = Math.max((Date.now() - start) / 1000, 0.1);
  const captureFps = Math.max(i / elapsedSec, 1);
  const silent = dest.replace(/\.mp4$/, ".silent.mp4");
  execSync(
    `ffmpeg -y -framerate ${captureFps.toFixed(3)} -i ${dir}/%04d.jpg -vf tpad=stop_mode=clone:stop_duration=4 -c:v libx264 -pix_fmt yuv420p -r 30 -crf 18 -movflags +faststart -t 4 "${silent}"`,
    { stdio: "inherit" },
  );
  execSync(
    `ffmpeg -y -i "${silent}" -i /workspace/public/sfx/lifting.mp3 -filter_complex "[1:a]adelay=700|700,apad[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -shortest -t 4 "${dest}"`,
    { stdio: "inherit" },
  );
  fs.rmSync(silent, { force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.type('input[name="email"]', "streaks@example.com");
  await page.type('input[name="password"]', "password12");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function openUnlock(page: Page, id: string) {
  await page.goto(`${BASE}/progress?unlock=${id}&unlockPreview=1&t=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector("[data-badge-unlock='1']", { timeout: 15_000 });
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
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await login(page);

  await page.goto(`${BASE}/progress`, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.waitForSelector("#badges", { timeout: 15_000 });
  await delay(200);
  await page.screenshot({ path: path.join(ART, "cat_progress_v3.png"), type: "png" });
  console.log("wrote cat_progress_v3.png");
  await page.screenshot({ path: path.join(ART, "cat_progress_v4.png"), type: "png" });
  console.log("wrote cat_progress_v4.png");

  await openUnlock(page, "lift_200kg");
  await delay(1180);
  await page.screenshot({ path: path.join(ART, "cat_unlock_lift_v3.png"), type: "png" });
  console.log("wrote cat_unlock_lift_v3.png");

  await openUnlock(page, "pads_250");
  await delay(1180);
  await page.screenshot({ path: path.join(ART, "cat_unlock_martial_v3.png"), type: "png" });
  console.log("wrote cat_unlock_martial_v3.png");

  await openUnlock(page, "lift_200kg");
  await delay(2000);
  await page.screenshot({ path: path.join(ART, "cat_unlock_final_v4.png"), type: "png" });
  console.log("wrote cat_unlock_final_v4.png");

  await openUnlock(page, "lift_200kg");
  await recordMp4(page, path.join(ART, "cat_unlock_v3.mp4"), 4000);
  console.log("wrote cat_unlock_v3.mp4");

  await page.goto(`${BASE}/timer`, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    buttons.find((btn) => btn.textContent?.trim() === "Grappling")?.click();
  });
  await delay(250);
  await page.screenshot({ path: path.join(ART, "cat_logging_v3.png"), type: "png" });
  console.log("wrote cat_logging_v3.png");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
