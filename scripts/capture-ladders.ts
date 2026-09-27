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

async function recordMp4(page: Page, dest: string, ms = 8000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lad-frames-"));
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
    `ffmpeg -y -framerate ${captureFps.toFixed(3)} -i ${dir}/%04d.jpg -c:v libx264 -pix_fmt yuv420p -r 30 -crf 18 -movflags +faststart "${silent}"`,
    { stdio: "inherit" },
  );
  const sfx = fs.existsSync("/workspace/public/sfx/unlock_cinematic.mp3")
    ? "/workspace/public/sfx/unlock_cinematic.mp3"
    : "";
  if (sfx) {
    execSync(
      `ffmpeg -y -i "${silent}" -i "${sfx}" -filter_complex "[1:a]adelay=700|700,apad[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -shortest "${dest}"`,
      { stdio: "inherit" },
    );
  } else {
    execSync(
      `ffmpeg -y -f lavfi -i "sine=frequency=740:duration=0.12" -f lavfi -i "sine=frequency=1480:duration=0.28" -i "${silent}" -filter_complex "[0:a]volume=0.35[a0];[1:a]adelay=80|80,volume=0.25[a1];[a0][a1]amix=inputs=2:duration=longest,apad[a]" -map 2:v -map "[a]" -c:v copy -c:a aac -shortest "${dest}"`,
      { stdio: "inherit" },
    );
  }
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
  await page.waitForSelector("[data-badge-grid='ladders']", { timeout: 15_000 });
  await delay(250);
  await page.screenshot({ path: path.join(ART, "lad_progress.png"), type: "png" });
  console.log("wrote lad_progress.png");

  const doneHref = await page.evaluate(() => {
    const link = [...document.querySelectorAll("a")].find((el) =>
      /\/training\/log\/[^/]+\/done/.test(el.getAttribute("href") ?? ""),
    );
    return link?.getAttribute("href") ?? "";
  });
  if (doneHref) {
    await page.goto(`${BASE}${doneHref}?pendingUnlock=lift_l1&unlock=lift_l1`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
  } else {
    await page.goto(`${BASE}/progress?unlock=lift_l5&unlockPreview=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }
  await page.waitForSelector("[data-workout-win='1']", { timeout: 15_000 }).catch(() => null);
  await delay(1100);
  await page.screenshot({ path: path.join(ART, "lad_workout_done.png"), type: "png" });
  console.log("wrote lad_workout_done.png");

  await openUnlock(page, "lift_l5");
  await delay(1180);
  await page.screenshot({ path: path.join(ART, "lad_unlock_peak.png"), type: "png" });
  console.log("wrote lad_unlock_peak.png");

  if (doneHref) {
    await page.goto(`${BASE}${doneHref}?pendingUnlock=lift_l1,first_session&unlock=lift_l1,first_session`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
    await page.waitForSelector("[data-workout-win='1']", { timeout: 15_000 });
    const record = recordMp4(page, path.join(ART, "lad_finish_flow.mp4"), 7800);
    await delay(1600);
    await page.click("[data-win-done='1']");
    await page.waitForSelector("[data-badge-unlock='1']", { timeout: 10_000 }).catch(() => null);
    await record;
  } else {
    await openUnlock(page, "lift_l1");
    await recordMp4(page, path.join(ART, "lad_finish_flow.mp4"), 4000);
  }
  console.log("wrote lad_finish_flow.mp4");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
