import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
test.describe("member", () => routeSuite(["/bagwork", "/bagwork/new", "/fight-camp", "/mobility", "/mobility/check-in", "/mobility/drills", "/mobility/progression", "/paths", "/plan", "/sparring", "/timer", "/training", "/training/calendar", "/training/history", "/training/history/bike", "/training/my-workouts", "/training/testing", "/training/travel"], "@member"));
// Dynamic routes need seeded IDs; NOT-AUTOMATED for now: /bagwork/[slug], /bagwork/saved/[id], /bagwork/saved/[id]/edit, /mobility/[routineId], /mobility/[routineId]/log, /mobility/[routineId]/play, /paths/[slug], /training/[dayId], /training/[dayId]/start, /training/log/[sessionId], /training/log/[sessionId]/done, /training/my-workouts/[id], /training/my-workouts/day/[planId]
