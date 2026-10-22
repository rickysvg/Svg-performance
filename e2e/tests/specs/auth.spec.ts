import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
test.describe("public", () => routeSuite(["/", "/forgot-password", "/login", "/pricing", "/register", "/reset-password", "/signup", "/verify-email"], "@public"));
test.describe("member", () => routeSuite(["/billing/cancel", "/billing/success", "/onboarding", "/onboarding/deeper", "/onboarding/plan"], "@member"));
