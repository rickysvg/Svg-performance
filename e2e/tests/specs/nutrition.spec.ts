import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
test.describe("member", () => routeSuite(["/fuel", "/nutrition", "/nutrition/prep"], "@member"));
// Dynamic routes need seeded IDs; NOT-AUTOMATED for now: /nutrition/[entryId]
