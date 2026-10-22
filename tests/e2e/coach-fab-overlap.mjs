/**
 * Mobile overlap check for the coach button.
 * Viewport 390×727. Scrolls /training, /bagwork, /training/calendar, and /home.
 * The center of every button, link, and input must not hit [data-coach-fab].
 *
 *   node tests/e2e/coach-fab-overlap.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/node_modules/playwright-core");

const BASE = process.env.CAPTURE_BASE ?? "http://127.0.0.1:3000";
const ROUTES = ["/training", "/bagwork", "/training/calendar", "/home"];

function assertNoFabHit(overlaps, route, scrollY) {
  if (overlaps.length === 0) return;
  const sample = overlaps.slice(0, 6).join(" | ");
  throw new Error(`${route} scroll ${scrollY} coach button covers: ${sample}`);
}

async function overlapsAt(page) {
  return page.evaluate(() => {
    const fab = document.querySelector("[data-coach-fab]");
    const nodes = [...document.querySelectorAll("button, a, input")];
    const hits = [];
    for (const el of nodes) {
      if (el.closest("[data-coach-fab]")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (top && fab && (top === fab || fab.contains(top))) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.tagName || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        hits.push(label || el.tagName);
      }
    }
    return hits;
  });
}

async function scrollAndAssert(page, route) {
  const height = await page.evaluate(
    () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  );
  const steps = 8;
  for (let index = 0; index <= steps; index += 1) {
    const top = Math.round((Math.max(0, height - windowHeight(page)) * index) / steps);
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(280);
    const hits = await overlapsAt(page);
    assertNoFabHit(hits, route, top);
  }
}

function windowHeight() {
  return 727;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 727 } });
  await page.addInitScript(() => {
    sessionStorage.setItem("svg_splash_seen", "1");
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.fill('input[name="email"]', process.env.E2E_EMAIL || "member@example.com");
  await page.fill('input[name="password"]', process.env.E2E_PASSWORD || "password12");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(400);
    const landed = new URL(page.url()).pathname;
    if (!landed.startsWith(route)) {
      throw new Error(`${route} redirected to ${landed}`);
    }
    await scrollAndAssert(page, route);
    console.log("clear", route);
  }

  await browser.close();
  console.log("coach fab overlap ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
