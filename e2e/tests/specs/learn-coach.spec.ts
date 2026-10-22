import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
test.describe("member", () => routeSuite(["/book", "/checkin", "/clips", "/coach", "/coach/checkins", "/feedback", "/form-check", "/learn", "/shop", "/staff", "/staff/coaching", "/staff/help", "/staff/reports", "/vip/apply", "/vip/checkout"], "@member"));
// Dynamic routes need seeded IDs; NOT-AUTOMATED for now: /clips/[clipId], /learn/[slug], /learn/seminars/[slug]
