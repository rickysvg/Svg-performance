import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  coachingDesk,
  formatAdminWhen,
  memberMatchesQuery,
  memberPlanSnapshot,
  revenueSnapshot,
} from "@/lib/admin-dashboard";
import {
  COACHING_NEAR_SEATS,
  coachingCapacityTone,
  deskTone,
  isFailedPaymentStatus,
  memberListTone,
  queueItemTone,
  weekDayTone,
} from "@/lib/admin-desk-status";
import { validateAnnouncementDraft } from "@/lib/announcements";
import { isDashboardAdmin } from "@/lib/admin-access";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("coach desk access and counters", () => {
  it("opens the desk for role admins and ADMIN_EMAILS", () => {
    const previous = process.env.ADMIN_EMAILS;
    try {
      delete process.env.ADMIN_EMAILS;
      expect(isDashboardAdmin({ role: "admin", email: "other@example.com" })).toBe(true);
      expect(isDashboardAdmin({ role: "member", email: "ricky@svg.example" })).toBe(false);
      process.env.ADMIN_EMAILS = "Ricky@SVG.example";
      expect(isDashboardAdmin({ role: "member", email: "ricky@svg.example" })).toBe(true);
      expect(isDashboardAdmin({ role: "member", email: "fan@example.com" })).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = previous;
    }
  });

  it("counts coaching seats against 20", () => {
    expect(coachingDesk(7)).toMatchObject({ used: 7, cap: 20, remaining: 13, full: false });
    expect(coachingDesk(20).full).toBe(true);
  });

  it("keeps seat caps off public pricing", () => {
    const pricing = read("src/components/pricing/PricingCatalog.tsx");
    const page = read("src/app/pricing/page.tsx");
    expect(pricing).not.toMatch(/of 40/);
    expect(pricing).not.toMatch(/founding/i);
    expect(page).not.toContain("/admin/founding");
    expect(page).not.toMatch(/founding/i);
    expect(page).toContain("$9.99/month or $72.99/year");
  });

  it("labels plan, trial, and academy from the same rules as access", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(
      memberPlanSnapshot({
        now,
        plan: "performance_monthly",
        status: "active",
        periodEnd: null,
        verified: true,
        trialEndsAt: null,
      }).label,
    ).toBe("SVG Pro");
    expect(
      memberPlanSnapshot({
        now,
        plan: null,
        status: null,
        periodEnd: null,
        verified: false,
        trialEndsAt: new Date("2026-10-25T12:00:00.000Z"),
      }),
    ).toMatchObject({ label: "Pro trial", trial: true, academy: false });
    expect(
      memberPlanSnapshot({
        now,
        plan: null,
        status: null,
        periodEnd: null,
        verified: true,
        trialEndsAt: null,
      }),
    ).toMatchObject({ label: "Academy member", academy: true });
  });

  it("counts active Pro, open trials, and trial conversions", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    const snapshot = revenueSnapshot({
      now,
      subscriptions: [
        { userId: "pro", plan: "performance_year", status: "active", currentPeriodEnd: null },
        { userId: "coach", plan: "coaching", status: "active", currentPeriodEnd: null },
        { userId: "old", plan: "performance", status: "canceled", currentPeriodEnd: null },
      ],
      profiles: [
        { userId: "pro", trialEndsAt: null, trialStartedAt: new Date("2026-09-01T00:00:00.000Z") },
        { userId: "trial", trialEndsAt: new Date("2026-10-24T00:00:00.000Z"), trialStartedAt: now },
        { userId: "coach", trialEndsAt: null, trialStartedAt: new Date("2026-08-01T00:00:00.000Z") },
        { userId: "done", trialEndsAt: new Date("2026-10-01T00:00:00.000Z"), trialStartedAt: new Date("2026-09-20T00:00:00.000Z") },
      ],
    });
    expect(snapshot).toMatchObject({ activePro: 1, trials: 1, conversions: 2, empty: false });
    expect(
      revenueSnapshot({ now, subscriptions: [], profiles: [] }),
    ).toMatchObject({ empty: true, activePro: 0, trials: 0, conversions: 0 });
  });

  it("searches members and formats last active", () => {
    expect(memberMatchesQuery({ name: "Ava Lopez", email: "ava@svg.example" }, "lopez")).toBe(true);
    expect(memberMatchesQuery({ name: "Ava Lopez", email: "ava@svg.example" }, "nope")).toBe(false);
    const now = new Date("2026-10-20T18:00:00.000Z");
    expect(formatAdminWhen(null, now)).toBe("No activity yet");
    expect(formatAdminWhen(now, now)).toBe("Today");
  });

  it("refuses to send an announcement until the confirm step", () => {
    expect(
      validateAnnouncementDraft({
        confirm: "",
        audience: "members",
        channel: "email",
        subject: "Sunday sparring",
        body: "Doors at 9.",
      }).ok,
    ).toBe(false);
    const ready = validateAnnouncementDraft({
      confirm: "send",
      audience: "coaching",
      channel: "push",
      subject: "Sunday sparring",
      body: "Doors at 9.",
    });
    expect(ready.ok).toBe(true);
    if (ready.ok) expect(ready.draft.audience).toBe("coaching");
  });

  it("puts the coach tiles on the admin grid and keeps a back button", () => {
    const desk = read("src/app/(member)/admin/page.tsx");
    expect(desk).toContain('data-admin-grid="1"');
    expect(desk).toContain("Form checks");
    expect(desk).toContain("Check-ins");
    expect(desk).toContain("Members");
    expect(desk).toContain("Coaching");
    expect(desk).not.toMatch(/founding/i);
    expect(desk).toContain("Revenue");
    expect(desk).toContain("Feedback");
    expect(desk).toContain("Content");
    expect(desk).toContain("Announce");
    expect(desk.indexOf("Form checks")).toBeLessThan(desk.indexOf("Check-ins"));
    const tile = read("src/components/admin/AdminTile.tsx");
    expect(tile).toContain("#FF3B3B");
    expect(tile).toContain("#CBF805");
    expect(tile).toContain("data-desk-tone");
    expect(desk).toContain('tone="idle"');
    expect(desk).toContain("deskTone");
    expect(desk).toContain("coachingCapacityTone");
    expect(desk).not.toContain("Pilot toolkit");
    const form = read("src/components/form-check/FormCheckReviewForm.tsx");
    expect(form).toContain("Chin tucked.");
    expect(form).toContain("Mark reviewed");
    const back = read("src/components/admin/AdminChrome.tsx");
    expect(back).toContain("AdminBack");
    const ai = read("src/lib/weekly-checkin-ai.ts");
    expect(ai).toContain("checkInAiEnabled");
  });

  it("colors a tile red only while work is open, then lime, otherwise neutral", () => {
    expect(deskTone(2, 4)).toBe("attention");
    expect(deskTone(0, 4)).toBe("clear");
    expect(deskTone(0, 0)).toBe("idle");
    expect(queueItemTone(false)).toBe("attention");
    expect(queueItemTone(true)).toBe("clear");
  });

  it("flags coaching when the cap is near or full", () => {
    expect(COACHING_NEAR_SEATS).toBe(2);
    expect(coachingCapacityTone(17, 20)).toBe("idle");
    expect(coachingCapacityTone(18, 20)).toBe("attention");
    expect(coachingCapacityTone(20, 20)).toBe("attention");
    expect(isFailedPaymentStatus("past_due")).toBe(true);
    expect(isFailedPaymentStatus("unpaid")).toBe(true);
    expect(isFailedPaymentStatus("active")).toBe(false);
    expect(isFailedPaymentStatus("incomplete")).toBe(false);
  });

  it("marks a missed week red and a completed week lime", () => {
    expect(memberListTone([{ missed: true, completed: false }])).toBe("attention");
    expect(memberListTone([{ missed: false, completed: true }])).toBe("clear");
    expect(memberListTone([{ missed: false, completed: false }])).toBe("idle");
    expect(weekDayTone({ missed: true, completed: false })).toBe("attention");
    expect(weekDayTone({ missed: false, completed: true })).toBe("clear");
  });
});
