import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("delete workout navigation", () => {
  it("sends a deleted session, including a bike log, to training history", () => {
    const action = readFileSync("src/app/actions/workouts.ts", "utf8");
    const button = readFileSync("src/components/training/DeleteWorkoutButton.tsx", "utf8");
    const log = readFileSync("src/app/(member)/training/log/[sessionId]/page.tsx", "utf8");

    expect(action).toMatch(
      /export async function deleteWorkoutAction[\s\S]*?redirect\("\/training\/history"\)/,
    );
    expect(button).toContain("deleteWorkoutAction");
    expect(log).toContain("DeleteWorkoutButton");
  });
});
