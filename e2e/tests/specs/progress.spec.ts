import { test } from "@playwright/test";
import { routeSuite } from "../lib";
// Inventory IDs covered: every element on these routes (see interaction-map.md).
test.describe("member", () => routeSuite(["/challenges", "/heart", "/journal", "/progress", "/progress/photos", "/progress/records", "/progress/streaks", "/report"], "@member"));
// Dynamic routes are in dynamic.spec.ts. /progress/photos/[photoId] skips when the account has no photo.
