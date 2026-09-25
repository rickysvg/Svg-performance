import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SVG Coach streaming UI", () => {
  it("shows a Stop control and typing state in chat and notepad", () => {
    const thread = fs.readFileSync(
      path.join(process.cwd(), "src/components/coach/CoachLiveThread.tsx"),
      "utf8",
    );
    const notepad = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/ExerciseNotepad.tsx"),
      "utf8",
    );
    const hook = fs.readFileSync(
      path.join(process.cwd(), "src/components/coach/useCoachStream.ts"),
      "utf8",
    );
    expect(thread).toContain("data-coach-stop");
    expect(thread).toContain("Stop");
    expect(thread).toContain("data-coach-typing");
    expect(hook).toContain("/api/coach/stream");
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/coach/stream/route.ts"),
      "utf8",
    );
    expect(route).toContain("status: 401");
    expect(route).toContain("Sign in to talk to SVG Coach.");
    expect(thread).not.toMatch(/\bbouts?\b/);
    expect(notepad).toContain("data-notepad-stop");
    expect(notepad).toContain("useCoachStream");
    expect(notepad).toContain("kind: \"note\"");
  });
});
