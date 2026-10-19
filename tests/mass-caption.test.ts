import { describe, expect, it } from "vitest";
import { massCaption, parseMassFont } from "@/lib/mass-caption";

const tz = "America/Denver";

describe("mass caption", () => {
  it("stays empty of filler when nothing is logged", () => {
    expect(massCaption(null, null, tz)).toBe("No weigh-in yet");
  });

  it("names the only weigh-in date", () => {
    expect(
      massCaption({ value: 173.2, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") }, null, tz),
    ).toBe("Last weigh-in · Oct 18");
  });

  it("shows the signed change versus last week when the previous log is about seven days earlier", () => {
    expect(
      massCaption(
        { value: 173.2, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") },
        { value: 174.6, unit: "lb", recordedAt: new Date("2026-10-11T18:00:00Z") },
        tz,
      ),
    ).toBe("-1.4 lbs vs last week");
  });

  it("uses the previous date when the gap is not a week", () => {
    expect(
      massCaption(
        { value: 173.2, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") },
        { value: 176.4, unit: "lb", recordedAt: new Date("2026-09-01T18:00:00Z") },
        tz,
      ),
    ).toBe("-3.2 lbs vs Sep 1");
  });

  it("treats an omitted or unknown massFont as the current face", () => {
    expect(parseMassFont(undefined)).toBe(1);
    expect(parseMassFont("1")).toBe(1);
    expect(parseMassFont("9")).toBe(1);
    expect(parseMassFont("3")).toBe(3);
  });
});
