import { test, expect, Page, TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";
import { STORAGE } from "./storage";

export type El = { id: string; kind: string; file: string; line: number; label: string; expect: string; unsafe: boolean };
type Inv = Record<string, { gating: string; els: El[] }>;
export const inventory: Inv = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/inventory.json"), "utf8"));
export const PUBLIC = ["/login", "/register", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/pricing"];
export { STORAGE };

const alwaysRenderIds = new Set<string>(
  JSON.parse(fs.readFileSync(path.join(__dirname, "../data/always-render.json"), "utf8")).ids as string[],
);

/** On in CI unless STRICT=0. Local runs stay off unless STRICT=1. */
export function strictMode() {
  const raw = process.env.STRICT;
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return process.env.CI === "true";
}

/**
 * Prefer the stable data-testid written for controls that had no href, role name,
 * or aria-label. Repeated lists use a prefix (`data-testid^="route-element-"`).
 */
function locatorFor(page: Page, el: El) {
  const testid = el.label.match(/^data-testid="([^"]+)"$/);
  if (testid && !testid[1].includes("(")) return page.locator(`[data-testid="${testid[1]}"]`);
  const prefix = el.label.match(/^data-testid\^="([^"]+)"$/);
  if (prefix) return page.locator(`[data-testid^="${prefix[1]}"]`);
  const m = el.expect.match(/^navigate to (\/[^\s${}]*)$/);
  if (el.kind === "link" && m) return page.locator(`a[href="${m[1]}"], a[href^="${m[1]}?"]`);
  const a = el.label.match(/^(aria-label|data-testid|title)="([^"]+)"$/);
  if (a && !a[2].includes("(")) return page.locator(`[${a[1]}="${a[2]}"]`);
  const t = el.label.match(/^"(.+)"$/);
  if (t) {
    const txt = t[1].replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'");
    if (el.kind === "link") return page.getByRole("link", { name: txt, exact: false });
    if (el.kind === "button") return page.getByRole("button", { name: txt, exact: false });
    return page.getByText(txt, { exact: false });
  }
  return null;
}
function record(info: TestInfo, id: string, status: string, note = "") {
  const dir = path.join("results", "items", info.project.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "items.jsonl"), JSON.stringify({ id, status, note, route: info.title }) + "\n");
}
async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/**
 * Open `urlPath` and check the inventory entry `inventoryKey`.
 * For static routes the two are the same. Dynamic routes pass the pattern key
 * (`/training/[dayId]`) and a concrete pathname discovered from the test account.
 */
export async function exerciseRoute(page: Page, info: TestInfo, inventoryKey: string, urlPath: string) {
  const entry = inventory[inventoryKey];
  if (!entry) return;
  const strict = strictMode();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const resp = await page.goto(urlPath, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const status = resp?.status() ?? 0;
  const finalPath = new URL(page.url()).pathname;
  const expectedPath = urlPath.split(/[?#]/)[0];
  expect.soft(status, `${inventoryKey} HTTP status`).toBeLessThan(500);
  const body = await page.locator("body").innerText().catch(() => "");
  const crashed = /application error|something went wrong|unhandled runtime error/i.test(body);
  expect.soft(crashed, `${inventoryKey} renders without error boundary`).toBe(false);
  const ov = await overflow(page);
  expect.soft(ov, `${inventoryKey} no horizontal overflow at ${page.viewportSize()?.width}px`).toBeLessThanOrEqual(1);
  record(info, `ROUTE:${inventoryKey}`, status >= 500 || crashed ? "FAIL" : ov > 1 ? "FAIL" : "PASS",
    `status=${status} final=${finalPath} overflow=${ov}px errors=${errors.slice(0, 2).join(" / ")}`);
  const shot = expectedPath.replace(/\//g, "_") || "_";
  await page.screenshot({ path: `results/shots/${info.project.name}${shot}.png`, fullPage: true }).catch(() => {});

  const els = inventoryKey === "/home" ? [...entry.els, ...(inventory["(shared chrome & shared components)"]?.els ?? [])] : entry.els;
  if (finalPath !== expectedPath) {
    const gate = expectedPath.startsWith("/staff") || expectedPath === "/coach/checkins" || inventoryKey.startsWith("/admin")
      ? "BLOCKED-NO-ACCESS"
      : "REDIRECTED";
    for (const el of els) record(info, el.id, gate, `route redirected to ${finalPath}`);
    return;
  }
  for (const el of els) {
    if (["input", "modal", "modal-close", "card-tap", "swipe", "long-press"].includes(el.kind) && !el.label) { record(info, el.id, "NOT-AUTOMATED", "no stable selector"); continue; }
    const loc = locatorFor(page, el);
    if (!loc) { record(info, el.id, "NOT-AUTOMATED", "dynamic label/selector"); continue; }
    const count = await loc.count().catch(() => 0);
    if (count === 0) {
      if (strict && alwaysRenderIds.has(el.id)) {
        record(info, el.id, "FAIL", `always-render testid missing (${el.label})`);
        expect.soft(count, `${el.id} always-render testid missing (${el.label})`).toBeGreaterThan(0);
        continue;
      }
      record(info, el.id, "NOT-PRESENT", "not rendered in test account state");
      continue;
    }
    const first = loc.first();
    const visible = await first.isVisible().catch(() => false);
    if (!visible) { record(info, el.id, "NOT-PRESENT", "rendered but hidden (collapsed / menu)"); continue; }
    const box = await first.boundingBox();
    const vw = page.viewportSize()!.width;
    if (box && (box.x < -1 || box.x + box.width > vw + 1)) { record(info, el.id, "FAIL", `clipped: x=${Math.round(box.x)} w=${Math.round(box.width)} vw=${vw}`); continue; }
    if (el.unsafe) {
      record(info, el.id, "SKIP-UNSAFE", `present, enabled=${await first.isEnabled().catch(() => false)}; not submitted`);
      continue;
    }
    const nav = el.expect.match(/^navigate to (\/[^\s${}]*)$/);
    if (el.kind === "link" && nav) {
      const target = nav[1].split(/[?#]/)[0];
      try {
        await first.scrollIntoViewIfNeeded();
        const before = page.url();
        await first.click({ timeout: 5_000 });
        await page.waitForURL((u) => u.toString() !== before, { timeout: 8_000 }).catch(() => {});
        await page.waitForLoadState("domcontentloaded");
        const landed = new URL(page.url()).pathname;
        const ok = landed === target || landed.startsWith(target + "/") || (landed === "/login" && !PUBLIC.includes(target));
        const txt = await page.locator("body").innerText().catch(() => "");
        const nf = /404|could not be found|page not found/i.test(txt.slice(0, 600));
        record(info, el.id, ok && !nf ? "PASS" : "FAIL", `expected ${target}, landed ${landed}${nf ? " (404 copy)" : ""}`);
      } catch (e) {
        record(info, el.id, "FAIL", `click/navigation failed: ${(e as Error).message.split("\n")[0]}`);
      }
      await page.goto(expectedPath, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      continue;
    }
    const enabled = await first.isEnabled().catch(() => false);
    record(info, el.id, "PASS", `visible, enabled=${enabled}`);
  }
}

export function routeSuite(routes: string[], tag: "@public" | "@member") {
  if (tag === "@member") test.use({ storageState: STORAGE });
  for (const route of routes) {
    if (!inventory[route]) continue;
    test(`${route} ${tag}`, async ({ page }, info) => {
      await exerciseRoute(page, info, route, route);
    });
  }
}
