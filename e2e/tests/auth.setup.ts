import { test as setup, expect, type Page } from "@playwright/test";
import { prepareStorage, STORAGE } from "./storage";

/**
 * Set an input without locator.fill(). Playwright records fill() as
 * `Fill "{value}"` in the JSON report, HTML report, and trace. The value
 * reaches the page through a binding, which is not a reported parameter.
 */
async function setLoginField(page: Page, selector: string, value: string) {
  const binding = `__e2eLogin_${selector.replace(/[^a-z]/gi, "")}`;
  await page.exposeBinding(binding, () => value);
  await page.locator(selector).evaluate(async (el, name: string) => {
    const read = (window as unknown as Record<string, (key: string) => Promise<string>>)[name];
    const next = await read(name);
    const input = el as HTMLInputElement;
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    proto?.set?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, binding);
}

/** Error snapshots are taken after the test function. Empty the fields first. */
async function scrubLoginFields(page: Page) {
  try {
    if (!new URL(page.url()).pathname.startsWith("/login")) return;
    await page.locator('input[name="email"], input[name="password"]').evaluateAll((els) => {
      for (const el of els) {
        if (!(el instanceof HTMLInputElement)) continue;
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        proto?.set?.call(el, "");
      }
    });
  } catch {
    // Leave the original login error intact.
  }
}

setup("authenticate test member", async ({ page }) => {
  const email = process.env.TEST_EMAIL, password = process.env.TEST_PASSWORD;
  if (!email || !password) throw new Error("Set TEST_EMAIL and TEST_PASSWORD env vars");
  try {
    await page.goto("/login");
    await setLoginField(page, 'input[name="email"]', email);
    await setLoginField(page, 'input[name="password"]', password);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/login/);
    prepareStorage();
    await page.context().storageState({ path: STORAGE });
  } finally {
    await scrubLoginFields(page);
  }
});
