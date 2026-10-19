import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Vercel Hobby rejects a cron that can run more than once per day. */
export function hobbyCronRunsMoreThanDaily(schedule: string) {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return true;
  const [minute, hour] = fields;
  const repeatsWithinADay = (field: string) =>
    field === "*" || field.includes(",") || field.includes("/") || field.includes("-");
  return repeatsWithinADay(minute!) || repeatsWithinADay(hour!);
}

describe("vercel.json crons", () => {
  it("stays on once-a-day schedules so Hobby can deploy", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons.map((row) => `${row.path} ${row.schedule}`)).toEqual([
      "/api/cron/gymdesk 0 12 * * *",
      "/api/cron/checkins 0 0 * * *",
    ]);
    for (const cron of config.crons) {
      expect(hobbyCronRunsMoreThanDaily(cron.schedule)).toBe(false);
    }
    expect(hobbyCronRunsMoreThanDaily("0 * * * *")).toBe(true);
    expect(hobbyCronRunsMoreThanDaily("*/30 * * * *")).toBe(true);
    expect(hobbyCronRunsMoreThanDaily("0 0,12 * * *")).toBe(true);
  });
});
