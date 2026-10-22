import { test as setup, expect } from "@playwright/test";
export const STORAGE = "results/.auth/member.json";
setup("authenticate test member", async ({ page }) => {
  const email = process.env.TEST_EMAIL, password = process.env.TEST_PASSWORD;
  if (!email || !password) throw new Error("Set TEST_EMAIL and TEST_PASSWORD env vars");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: STORAGE });
});
