import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatQualityReport, judgeCoachQuality } from "./judge";

describe("coach quality judge", () => {
  it("scores answers when OPENAI_API_KEY is set and skips otherwise", async () => {
    if (process.env.COACH_EVAL_JUDGE !== "1") {
      console.log("Quality judge skipped (set COACH_EVAL_JUDGE=1 to run it).");
      expect(true).toBe(true);
      return;
    }
    const report = await judgeCoachQuality();
    const text = formatQualityReport(report);
    writeFileSync("/tmp/coach-eval-quality.json", JSON.stringify(report, null, 2));
    writeFileSync("/tmp/coach-eval-quality.txt", text);
    console.log(text);
    if (report.skipped) {
      expect(report.reason).toMatch(/OPENAI_API_KEY/);
      return;
    }
    expect(report.judged).toBeGreaterThan(0);
  }, 180000);
});
