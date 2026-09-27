import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("QA-approved access and surface fixes", () => {
  it("does not grant platinum when Stripe keys are missing", () => {
    const entitlements = read("src/lib/entitlements.ts");
    const access = read("src/lib/access.ts");
    expect(entitlements).not.toMatch(/return "platinum"/);
    expect(entitlements).toMatch(/previewEntitlementsOpen\(\) \{\n  return false;/);
    expect(access).not.toMatch(/reason: "preview"/);
    expect(access).toMatch(/Missing Stripe keys do not unlock those tools/);
  });

  it("shows Paid plans coming soon instead of Stripe TEST key copy", () => {
    const pricing = read("src/app/pricing/page.tsx");
    const checkout = read("src/components/billing/CheckoutButton.tsx");
    const billing = read("src/lib/billing.ts");
    expect(pricing).toContain("Paid plans coming soon");
    expect(pricing).not.toMatch(/Stripe TEST keys are not in this environment/);
    expect(checkout).toContain("disabled");
    expect(billing).toContain("Paid plans coming soon.");
    const history = read("src/components/upgrade/UpgradePreview.tsx");
    const chart = read("src/components/progress/ExerciseChart.tsx");
    expect(history).toContain("Paid plans coming soon");
    expect(history).toContain("Longer history is a paid feature");
    expect(chart).toContain('kind="history"');
  });

  it("keeps streak and record copy worldwide and never uses bout", () => {
    const files = [
      "src/lib/streaks.ts",
      "src/lib/leaderboard.ts",
      "src/app/(member)/progress/streaks/page.tsx",
      "src/app/(member)/progress/records/page.tsx",
      "src/components/progress/StreakHero.tsx",
      "src/components/progress/ChallengeCard.tsx",
    ];
    for (const file of files) {
      const text = read(file).toLowerCase();
      expect(text).not.toContain("bout");
      expect(text).not.toContain("el paso");
    }
  });

  it("gates member entry on planChoiceAt", () => {
    const onboarding = read("src/lib/onboarding.ts");
    const session = read("src/lib/session.ts");
    const page = read("src/app/onboarding/page.tsx");
    expect(onboarding).toContain('if (!planChoiceAt) return "/onboarding/plan"');
    expect(session).toContain("if (!status.planChoiceAt)");
    expect(page).toContain('redirect(status.planChoiceAt ? "/home" : "/onboarding/plan")');
  });

  it("hints after Martial art and never leaves Coach empty", () => {
    const coach = read("src/app/(member)/coach/page.tsx");
    expect(coach).toContain("Pick your art to start chatting.");
  });

  it("uses REST DAY copy instead of No DEMO day loaded", () => {
    const guide = read("src/components/home/TodayGuide.tsx");
    expect(guide).toContain("REST DAY");
    expect(guide).toContain("Recover today. Next session:");
    expect(guide).not.toMatch(/No DEMO day loaded/i);
    expect(read("src/components/MemberFrame.tsx")).toContain("pb-36");
  });

  it("gives the 404 page header chrome and a Home link", () => {
    const page = read("src/app/not-found.tsx");
    expect(page).toContain("AppHeader");
    expect(page).toContain("Home");
  });

  it("keeps Progress chips at least 44px tall", () => {
    const progress = read("src/app/(member)/progress/page.tsx");
    expect(progress).toMatch(/touch-target[\s\S]*min-h-11[\s\S]*Heart rate/);
    expect(progress).toMatch(/touch-target[\s\S]*min-h-11[\s\S]*Settings/);
  });

  it("does not seed fake leaderboard people into production", () => {
    const production = read("prisma/seed.ts");
    expect(production).not.toMatch(/Maya J\.|Dani K\.|leaderboardOptIn/);
    const demo = read("scripts/seed-companion-demo.ts");
    expect(demo).toContain("Local screenshot athlete only");
    expect(demo).toContain("LOCAL_FAKE_BOARD");
    expect(demo).not.toMatch(/displayName: other\.name/);
    expect(demo).toMatch(/preferredUnits: "lb"/);
  });

  it("keeps lime or white text on inverted black companion blocks", () => {
    const challenge = read("src/components/progress/ChallengeCard.tsx");
    const podium = read("src/components/progress/LeaderboardPodium.tsx");
    const records = read("src/components/progress/RecordsList.tsx");
    const pr = read("src/components/progress/NewPrHero.tsx");
    expect(challenge).toContain("text-highlighter");
    expect(challenge).toContain("text-white");
    expect(challenge).not.toMatch(/bg-black[\s\S]*text-accent/);
    expect(podium).toContain("bg-black text-highlighter");
    expect(podium).toContain("No one else has opted in this month");
    expect(records).toContain("bg-black px-2 py-0.5 text-[10px] text-highlighter");
    expect(pr).toContain("bg-black");
    expect(pr).toContain("text-[#CBF805]");
  });

  it("ships photoreal belt plates on a four-across grid", () => {
    expect(read("src/components/progress/BadgePlate.tsx")).toContain("plateWebp");
    expect(read("src/components/progress/BadgeMark.tsx")).toContain("BadgePlate");
    expect(read("src/components/progress/BadgesGrid.tsx")).toContain("grid-cols-4");
    expect(read("src/components/progress/BadgesGrid.tsx")).toContain("font-display");
  });

  it("shows register progress after 6s and a timeout retry", () => {
    const form = read("src/components/auth/RegisterForm.tsx");
    expect(form).toContain("Still working, first sign-up can take a few seconds…");
    expect(form).toContain("This is taking too long. Refresh the page and try again.");
    expect(form).toContain("6_000");
  });
});
