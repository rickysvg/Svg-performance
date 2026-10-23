import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("delete workout navigation", () => {
  it("sends a logger delete to training and a history delete to history", () => {
    const action = readFileSync("src/app/actions/workouts.ts", "utf8");
    const button = readFileSync("src/components/training/DeleteWorkoutButton.tsx", "utf8");
    const log = readFileSync("src/app/(member)/training/log/[sessionId]/page.tsx", "utf8");
    const history = readFileSync("src/app/(member)/training/history/page.tsx", "utf8");

    expect(action).toMatch(
      /export async function deleteWorkoutAction[\s\S]*?redirect\(safe\)/,
    );
    expect(action).toContain('"/training/history"');
    expect(button).toContain("deleteWorkoutAction");
    expect(button).toContain('name="next"');
    expect(log).toContain('next="/training"');
    expect(history).toContain("<DeleteWorkoutButton");
    expect(history).not.toContain('next="/training"');
  });
});
