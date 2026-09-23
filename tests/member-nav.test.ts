import { describe, expect, it } from "vitest";
import {
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
  });
});
