import { describe, expect, it } from "vitest";
import { telemetryGraphTitle } from "@/lib/telemetry-title";

describe("telemetry graph title", () => {
  const todayKey = "2026-10-20";

  it("uses fight camp telemetry when an upcoming fight date is active", () => {
    expect(
      telemetryGraphTitle({ status: "active", fightDateKey: "2026-11-14", todayKey }),
    ).toBe("Fight Camp Telemetry");
    expect(
      telemetryGraphTitle({ status: "active", fightDateKey: todayKey, todayKey }),
    ).toBe("Fight Camp Telemetry");
  });

  it("uses training telemetry without an upcoming fight", () => {
    expect(telemetryGraphTitle({ status: null, fightDateKey: null, todayKey })).toBe(
      "Training Telemetry",
    );
    expect(
      telemetryGraphTitle({ status: "cancelled", fightDateKey: "2026-11-14", todayKey }),
    ).toBe("Training Telemetry");
    expect(
      telemetryGraphTitle({ status: "active", fightDateKey: "2026-10-19", todayKey }),
    ).toBe("Training Telemetry");
    expect(
      telemetryGraphTitle({ status: "active", fightDateKey: "not-a-date", todayKey }),
    ).toBe("Training Telemetry");
  });
});
