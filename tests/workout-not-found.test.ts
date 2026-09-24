import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getOwnWorkoutSessionOrNull } from "@/lib/workouts";

describe("forbidden or missing workout URLs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns null for a missing id so the page can render not-found", async () => {
    const user = await makeUser("ghost-workout@example.com");
    expect(await getOwnWorkoutSessionOrNull("does-not-exist", user.id)).toBeNull();
  });

  it("ships a dedicated workout not-found page instead of hanging on Loading", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/training/log/[sessionId]/page.tsx"),
      "utf8",
    );
    const notFound = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/training/log/[sessionId]/not-found.tsx"),
      "utf8",
    );
    expect(page).toContain("getOwnWorkoutSessionOrNull");
    expect(page).toContain("notFound()");
    expect(page).not.toContain("Loading this page");
    expect(notFound).toMatch(/Workout not found/);
    expect(notFound).toMatch(/Back to Train/);
  });
});
