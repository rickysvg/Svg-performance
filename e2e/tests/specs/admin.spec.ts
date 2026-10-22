import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
// BLOCKED-NO-ACCESS: test account is not admin. Enable with ADMIN_STORAGE once an admin test user exists.
test.describe("admin", () => { test.skip(!process.env.RUN_ADMIN, "BLOCKED-NO-ACCESS"); routeSuite(["/admin", "/admin/announcements", "/admin/challenges", "/admin/coaching", "/admin/content", "/admin/feedback", "/admin/focus", "/admin/form-checks", "/admin/gymdesk", "/admin/invites", "/admin/lessons", "/admin/lessons/new", "/admin/members", "/admin/plans", "/admin/queues", "/admin/revenue", "/admin/vip"], "@member"); });
// Dynamic routes need seeded IDs; NOT-AUTOMATED for now: /admin/lessons/[lessonId], /admin/members/[userId]
