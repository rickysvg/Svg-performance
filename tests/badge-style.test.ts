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
  it("uses category badge art instead of belt plates", () => {
    expect(read("src/components/progress/BadgeMark.tsx")).toContain("BadgeArt");
    expect(read("src/components/progress/BadgeArt.tsx")).toContain("badgeArtSrc");
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/streak_7.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/bag_250_locked.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/lift_225lb_hero.webp"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/progress/BadgePlate.tsx"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(process.cwd(), "public/badges/plate-steel-512.webp"))).toBe(false);
    expect(badgeArtSrc("lift_100kg", "lb", "progress")).toBe("/badges/lift_225lb.webp");
    expect(badgeArtSrc("lift_200kg", "kg", "hero")).toBe("/badges/lift_200kg_hero.webp");
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
    expect(badgeMark("bag_250")).toBe("250");
    expect(badgeMark("sparring_50")).toBe("50");
    expect(badgeTier("first_session")).toBe("bronze");
    expect(badgeTier("streak_7")).toBe("steel");
    expect(badgeTier("bag_250")).toBe("steel");
    expect(badgeTier("sparring_50")).toBe("steel");
    expect(badgeTier("grappling_50")).toBe("steel");
    expect(badgeTier("streak_30")).toBe("gold");
    expect(badgeTier("streak_100")).toBe("gold");
    expect(badgeTier("lift_200kg")).toBe("gold");
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
    expect(grid).toContain("Lifting");
    expect(grid).toContain("Martial Arts");
    expect(grid).toContain("Grind");
    expect(read("src/app/globals.css")).toContain("badge-pop");
    expect(read("src/app/globals.css")).toContain("prefers-reduced-motion");
  });
});
