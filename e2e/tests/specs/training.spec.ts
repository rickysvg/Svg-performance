import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
test.describe("member", () => routeSuite(["/bagwork", "/bagwork/new", "/fight-camp", "/mobility", "/mobility/check-in", "/mobility/drills", "/mobility/progression", "/paths", "/plan", "/sparring", "/timer", "/training", "/training/calendar", "/training/history", "/training/history/bike", "/training/my-workouts", "/training/testing", "/training/travel"], "@member"));
// Dynamic routes are in dynamic.spec.ts. They use a seeded path or a link from this account, and skip when neither exists.
