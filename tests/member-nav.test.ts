import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAccountNavActive,
  isPrimaryNavActive,
  PRIMARY_NAV_LINKS,
} from "@/lib/member-nav";

describe("member chrome swap", () => {
  it("keeps the six primary destinations in Home / Train / Fuel / Learn / Coach / Progress order", () => {
    expect(PRIMARY_NAV_LINKS.map((link) => link.label)).toEqual([
      "Home",
      "Train",
      "Fuel",
      "Learn",
      "Coach",
      "Progress",
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
    expect(isPrimaryNavActive("/progress", "/progress")).toBe(true);
    expect(isPrimaryNavActive("/progress/photos/abc", "/progress")).toBe(true);
    expect(isPrimaryNavActive("/home", "/progress")).toBe(false);
  });

  it("fits six equal Anton pills without a horizontal scroller", () => {
    const nav = fs.readFileSync(path.join(process.cwd(), "src/components/PrimaryNav.tsx"), "utf8");
    expect(nav).toContain("grid-cols-6");
    expect(nav).toContain("font-display");
    expect(nav).toContain("bg-accent");
    expect(nav).toContain("overflow-x-hidden");
    expect(nav).not.toContain("overflow-x-auto");
    expect(nav).not.toMatch(/truncate|text-ellipsis/);
  });

  it("highlights account chips for staff and member destinations", () => {
    expect(isAccountNavActive("/book", "/book")).toBe(true);
    expect(isAccountNavActive("/shop", "/profile")).toBe(false);
    expect(isAccountNavActive("/staff/coaching", "/staff/reports")).toBe(true);
    expect(isAccountNavActive("/admin/lessons", "/admin")).toBe(true);
  });
});
