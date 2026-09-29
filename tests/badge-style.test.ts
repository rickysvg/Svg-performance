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
import { badgeArtSrc } from "@/lib/badge-art";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("badge styles and progress", () => {
  it("uses ladder badge art with lb lift stems", () => {
    expect(read("src/components/progress/BadgeMark.tsx")).toContain("BadgeArt");
    expect(read("src/components/progress/BadgeArt.tsx")).toContain("badgeArtSrc");
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/streak_7.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/bag_250_locked.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/lift_l3_lb_hero.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/progress/BadgePlate.tsx"))).toBe(
      false,
    );
    expect(badgeArtSrc("lift_l3", "lb", "progress")).toBe("/badges/lift_l3_lb.webp");
    // kg preference is coerced to lb art in the UI
    expect(badgeArtSrc("lift_l5", "kg", "hero")).toBe("/badges/lift_l5_lb_hero.webp");
  });

  it("uses big milestone marks in pounds", () => {
    expect(badgeMark("lift_l3", "lb")).toBe("225");
    expect(badgeMark("lift_l5", "lb")).toBe("405");
    expect(badgeMark("lift_l3", "kg")).toBe("225");
    expect(badgeMark("lift_l5", "kg")).toBe("405");
    expect(badgeMark("streak_7")).toBe("7");
    expect(badgeMark("streak_30")).toBe("30");
    expect(badgeMark("streak_100")).toBe("100");
    expect(badgeMark("bike_50")).toBe("50");
    expect(badgeMark("pads_250")).toBe("250");
    expect(badgeMark("bag_250")).toBe("250");
    expect(badgeMark("sparring_50")).toBe("50");
    expect(badgeTier("first_session")).toBe("bronze");
    expect(badgeTier("streak_7")).toBe("bronze");
    expect(badgeTier("bag_250")).toBe("gold");
    expect(badgeTier("sparring_50")).toBe("gold");
    expect(badgeTier("grappling_50")).toBe("gold");
    expect(badgeTier("streak_30")).toBe("steel");
    expect(badgeTier("streak_100")).toBe("gold");
    expect(badgeTier("lift_l5")).toBe("gold");
    expect(badgeRibbon("pads_250")).toBe("Pads");
    expect(badgeRibbon("bag_250")).toBe("Bag");
  });

  it("shows current/target on a locked badge instead of a padlock mark", () => {
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
    expect(grid).toContain("group.label");
    expect(read("src/lib/badges.ts")).toContain('lifting: "Lifting"');
    expect(read("src/lib/badges.ts")).toContain('martial: "Martial Arts"');
    expect(read("src/lib/badges.ts")).toContain('grind: "Grind"');
    expect(read("src/app/globals.css")).toContain("badge-pop");
    expect(read("src/app/globals.css")).toContain("prefers-reduced-motion");
  });
});
