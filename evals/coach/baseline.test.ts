import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDeterministicReport, scoreCoachEval } from "./score";

describe("coach eval snapshot", () => {
  it("writes the deterministic report", () => {
    const report = scoreCoachEval();
    const text = formatDeterministicReport(report);
    writeFileSync("/tmp/coach-eval-report.json", JSON.stringify(report, null, 2));
    writeFileSync("/tmp/coach-eval-report.txt", text);
    console.log(text);
    expect(report.total).toBeGreaterThanOrEqual(40);
    expect(report.failed, text).toBe(0);
  });
});
