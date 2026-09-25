import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOTTOM_DOCK_LEFT,
  BOTTOM_DOCK_RIGHT,
  isAccountNavActive,
  isPrimaryNavActive,
  PRIMARY_NAV_LINKS,
} from "@/lib/member-nav";

describe("member chrome swap", () => {
  it("keeps the five primary destinations in Home / Train / Fuel / Learn / Coach order", () => {
    expect(PRIMARY_NAV_LINKS.map((link) => link.label)).toEqual([
      "Home",
      "Train",
      "Fuel",
      "Learn",
      "Coach",
    ]);
  });

  it("highlights Home only on /home", () => {
    expect(isPrimaryNavActive("/home", "/home")).toBe(true);
    expect(isPrimaryNavActive("/training", "/home")).toBe(false);
  });

  it("highlights a primary tab on its nested routes", () => {
    expect(isPrimaryNavActive("/learn/guard-retention", "/learn")).toBe(true);
    expect(isPrimaryNavActive("/coach?topic=mental", "/coach")).toBe(false);
    expect(isPrimaryNavActive("/coach", "/coach")).toBe(true);
    expect(isPrimaryNavActive("/training/calendar", "/training")).toBe(true);
    expect(isPrimaryNavActive("/nutrition/prep", "/fuel")).toBe(false);
    expect(isPrimaryNavActive("/nutrition/prep", "/nutrition")).toBe(true);
  });

  it("highlights account chips for staff and member destinations", () => {
    expect(isAccountNavActive("/book", "/book")).toBe(true);
    expect(isAccountNavActive("/shop", "/profile")).toBe(false);
    expect(isAccountNavActive("/staff/coaching", "/staff/reports")).toBe(true);
    expect(isAccountNavActive("/admin/lessons", "/admin")).toBe(true);
    expect(isAccountNavActive("/progress", "/progress")).toBe(true);
    expect(isAccountNavActive("/progress/photos/abc", "/progress")).toBe(true);
    expect(isAccountNavActive("/home", "/progress")).toBe(false);
  });

  it("puts Progress on the bottom dock and keeps the + between equal pairs", () => {
    expect(BOTTOM_DOCK_LEFT.map((link) => link.label)).toEqual(["Book", "Shop"]);
    expect(BOTTOM_DOCK_RIGHT.map((link) => link.label)).toEqual(["Progress", "Profile"]);
    const header = fs.readFileSync(
      path.join(process.cwd(), "src/components/AppHeader.tsx"),
      "utf8",
    );
    const profile = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/profile/page.tsx"),
      "utf8",
    );
    expect(header).toContain("data-bottom-dock");
    expect(header).toContain("grid-cols-5");
    expect(header).toContain("data-dock-link");
    expect(header).toContain("centerAction");
    expect(profile).toContain("logoutAction");
    expect(profile).toMatch(/Log out/);
  });
});
