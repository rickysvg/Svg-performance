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
  it("uses photoreal belt plates as the only badge mark", () => {
    expect(read("src/components/progress/BadgeMark.tsx")).toContain("BadgePlate");
    expect(read("src/components/progress/BadgePlate.tsx")).toContain("plate-");
    expect(read("src/lib/badge-plates.ts")).toContain("plate-${tier}");
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/plate-bronze-512.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/plate-steel-256.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/plate-gold-512.png"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/progress/BadgeBelt.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/progress/BadgeSvgShine.tsx"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/badge-style.ts"))).toBe(false);
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
    expect(badgeTier("first_session")).toBe("bronze");
    expect(badgeTier("streak_7")).toBe("steel");
    expect(badgeTier("streak_30")).toBe("gold");
    expect(badgeTier("streak_100")).toBe("gold");
    expect(badgeTier("lift_200kg")).toBe("gold");
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
