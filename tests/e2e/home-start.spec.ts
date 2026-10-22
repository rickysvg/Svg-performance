import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "bike-clock@example.com";
const password = process.env.E2E_PASSWORD ?? "password12";

if (!process.env.DATABASE_URL) {
  const line = fs
    .readFileSync(".env", "utf8")
    .split("\n")
    .find((row) => row.startsWith("DATABASE_URL="));
  const value = line?.slice(line.indexOf("=") + 1).trim().replace(/^"|"$/g, "");
  if (value) process.env.DATABASE_URL = value;
}

test.beforeEach(async () => {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    await prisma.workoutSession.deleteMany({ where: { userId: user.id, status: "draft" } });
  }
  await prisma.$disconnect();
});

test("Home Start opens the logger within 5 seconds and the coach avatar stays off it", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("svg_splash_seen", "1");
  });
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  await page.goto("/home");
  const start = page.locator('a[data-prime-coach-audio]').filter({ hasText: /^Start/ }).first();
  await expect(start).toBeVisible();
  await start.click();
  await expect(page).toHaveURL(/\/training\/log\//, { timeout: 5_000 });
  const save = page.locator("[data-save-workout]");
  await expect(save).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-coach-fab]")).toHaveCount(0);
  const saveBox = await save.boundingBox();
  expect(saveBox).not.toBeNull();
  const indicator = await page.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    const root = portal?.shadowRoot;
    if (!root) return "";
    return [...root.querySelectorAll("button")].map((node) => node.textContent ?? "").join(" ");
  });
  expect(indicator).not.toMatch(/issue/i);
});
