import { describe, expect, it } from "vitest";
import { subscriptionScheduleLine } from "@/lib/subscription-copy";

describe("subscription schedule line", () => {
  const now = new Date("2026-11-10T18:00:00.000Z");

  it("shows days left and the Stripe trial end", () => {
    const line = subscriptionScheduleLine(
      {
        plan: "performance",
        status: "trialing",
        trialEnd: new Date("2026-11-17T18:00:00.000Z"),
      },
      now,
    );
    expect(line).toContain("SVG Pro · Trial");
    expect(line).toContain("days left");
    expect(line).toContain("ends Nov 17");
  });

  it("shows a scheduled cancel from the portal", () => {
    const line = subscriptionScheduleLine(
      {
        plan: "performance",
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2026-11-17T18:00:00.000Z"),
      },
      now,
    );
    expect(line).toContain("Cancels on Nov 17");
  });
});
