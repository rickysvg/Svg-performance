import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  badgeMark,
  badgeProgressLabel,
  badgeRibbon,
  badgeTier,
  evaluateBadges,
} from "@/lib/badges";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("badge styles and progress", () => {
  it("uses the belt plate as the only badge mark", () => {
    expect(read("src/components/progress/BadgeMark.tsx")).toContain("BadgeBelt");
    expect(read("src/components/progress/BadgeMark.tsx")).not.toContain("BadgeMedal");
    expect(read("src/components/progress/BadgeMark.tsx")).not.toContain("BadgeHex");
    expect(read("src/components/progress/badge-visuals.ts")).toContain("M14,40 L20,20");
    expect(read("src/components/progress/BadgeBelt.tsx")).toContain("BELT_PLATE");
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/badge-style.ts"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/progress/BadgeMedal.tsx"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(process.cwd(), "src/components/progress/BadgeHex.tsx"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(process.cwd(), "src/app/(member)/progress/badge-preview/page.tsx")),
    ).toBe(false);
  });

  it("uses big milestone marks in the athlete unit", () => {
    expect(badgeMark("lift_100kg", "lb")).toBe("225");
    expect(badgeMark("lift_200kg", "lb")).toBe("405");
    expect(badgeMark("lift_100kg", "kg")).toBe("100");
    expect(badgeMark("lift_200kg", "kg")).toBe("200");
    expect(badgeMark("streak_7")).toBe("7");
    expect(badgeMark("streak_30")).toBe("30");
    expect(badgeMark("streak_100")).toBe("100");
    expect(badgeMark("bike_50")).toBe("50");
    expect(badgeMark("pads_250")).toBe("250");
    expect(badgeMark("hold_5min")).toBe("5:00");
    expect(badgeTier("lift_200kg")).toBe("lime");
    expect(badgeRibbon("pads_250")).toBe("Pads");
  });

  it("shows current/target on a locked badge instead of a padlock", () => {
    const badges = evaluateBadges({
      workoutCount: 12,
      currentStreak: 12,
      longestStreak: 12,
      displayUnit: "lb",
      sets: [],
    });
    const locked = badges.find((row) => row.id === "streak_30");
    expect(locked?.earned).toBe(false);
    expect(locked?.mark).toBe("30");
    expect(locked?.progressLabel).toBe("12/30");
    expect(badgeProgressLabel("hold_5min", 160, 300)).toBe("2:40/5:00");
    const grid = read("src/components/progress/BadgesGrid.tsx");
    expect(grid).not.toContain('"lock"');
    expect(read("src/components/progress/BadgeMark.tsx")).not.toContain("padlock");
    expect(read("src/app/globals.css")).toContain("badge-pop");
    expect(read("src/app/globals.css")).toContain("prefers-reduced-motion");
  });
});
