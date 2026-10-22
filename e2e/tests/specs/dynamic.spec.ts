import { test, type Page } from "@playwright/test";
import { exerciseRoute, STORAGE } from "../lib";

// The 21 inventory routes whose path contains a dynamic segment.
// Concrete ids come from E2E_SEEDED_PATHS or from links on the signed-in account.
// A route with no id is skipped. Nothing here submits an UNSAFE action.
test.use({ storageState: STORAGE });

function seededPath(key: string): string | null {
  const raw = process.env.E2E_SEEDED_PATHS;
  if (!raw) return null;
  let map: Record<string, unknown>;
  try {
    map = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const value = map[key];
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("..")) return null;
  return value.split(/[?#]/)[0];
}

async function firstPath(page: Page, from: string, match: (pathname: string) => boolean): Promise<string | null> {
  await page.goto(from, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
  for (const href of hrefs) {
    if (!href.startsWith("/")) continue;
    const pathname = href.split(/[?#]/)[0];
    if (match(pathname)) return pathname;
  }
  return null;
}

type RouteCase = {
  key: string;
  admin?: boolean;
  /** Hard skip. The route is listed so the inventory key is covered, and it is not opened. */
  skipReason?: string;
  resolve: (page: Page) => Promise<string | null>;
};

const oneSegment = (root: string, reserved: string[] = []) => {
  const blocked = new Set(reserved);
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return (pathname: string) => {
    if (!pathname.startsWith(prefix)) return false;
    const rest = pathname.slice(prefix.length);
    if (!rest || rest.includes("/")) return false;
    return !blocked.has(rest);
  };
};

const CASES: RouteCase[] = [
  {
    key: "/admin/lessons/[lessonId]",
    admin: true,
    resolve: (page) => firstPath(page, "/admin/lessons", oneSegment("/admin/lessons", ["new"])),
  },
  {
    key: "/admin/members/[userId]",
    admin: true,
    resolve: (page) => firstPath(page, "/admin/members", oneSegment("/admin/members")),
  },
  {
    key: "/bagwork/[slug]",
    resolve: (page) => firstPath(page, "/bagwork", oneSegment("/bagwork", ["new", "saved"])),
  },
  {
    key: "/bagwork/saved/[id]",
    resolve: (page) => firstPath(page, "/bagwork", oneSegment("/bagwork/saved")),
  },
  {
    key: "/bagwork/saved/[id]/edit",
    resolve: async (page) => {
      const saved = await firstPath(page, "/bagwork", oneSegment("/bagwork/saved"));
      return saved ? `${saved}/edit` : null;
    },
  },
  {
    key: "/clips/[clipId]",
    resolve: (page) => firstPath(page, "/clips", oneSegment("/clips")),
  },
  {
    key: "/learn/[slug]",
    resolve: (page) => firstPath(page, "/learn?tab=library", oneSegment("/learn", ["seminars"])),
  },
  {
    key: "/learn/seminars/[slug]",
    resolve: (page) => firstPath(page, "/learn", oneSegment("/learn/seminars")),
  },
  {
    key: "/mobility/[routineId]",
    resolve: (page) => firstPath(page, "/mobility", oneSegment("/mobility", ["check-in", "drills", "progression"])),
  },
  {
    key: "/mobility/[routineId]/log",
    resolve: async (page) => {
      const routine = await firstPath(page, "/mobility", oneSegment("/mobility", ["check-in", "drills", "progression"]));
      return routine ? `${routine}/log` : null;
    },
  },
  {
    key: "/mobility/[routineId]/play",
    resolve: async (page) => {
      const routine = await firstPath(page, "/mobility", oneSegment("/mobility", ["check-in", "drills", "progression"]));
      return routine ? `${routine}/play` : null;
    },
  },
  {
    key: "/nutrition/[entryId]",
    resolve: (page) => firstPath(page, "/nutrition", oneSegment("/nutrition", ["prep"])),
  },
  {
    key: "/paths/[slug]",
    resolve: (page) => firstPath(page, "/paths", oneSegment("/paths")),
  },
  {
    key: "/progress/photos/[photoId]",
    resolve: async (page) => {
      await page.goto("/progress/photos", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const testid = await page.locator('[data-testid^="progress-photos-photo-"]').first().getAttribute("data-testid").catch(() => null);
      const fromTestid = testid?.slice("progress-photos-photo-".length);
      if (fromTestid) return `/progress/photos/${fromTestid}`;
      const src = await page.locator('img[src^="/api/progress-photos/"]').first().getAttribute("src").catch(() => null);
      const photoId = src?.split("/").filter(Boolean).pop();
      return photoId ? `/progress/photos/${photoId}` : null;
    },
  },
  {
    key: "/progress/records/[slug]",
    resolve: (page) => firstPath(page, "/progress/records", oneSegment("/progress/records")),
  },
  {
    key: "/training/[dayId]",
    resolve: (page) =>
      firstPath(page, "/training/calendar", oneSegment("/training", ["calendar", "history", "testing", "travel", "my-workouts"])),
  },
  {
    key: "/training/[dayId]/start",
    skipReason: "GET /training/[dayId]/start calls startProgramDayLog and creates a session. The suite does not open it.",
    resolve: async () => null,
  },
  {
    key: "/training/log/[sessionId]",
    resolve: async (page) =>
      (await firstPath(page, "/training/history", (pathname) => /^\/training\/log\/[^/]+$/.test(pathname))) ??
      (await firstPath(page, "/training", (pathname) => /^\/training\/log\/[^/]+$/.test(pathname))),
  },
  {
    key: "/training/log/[sessionId]/done",
    resolve: (page) => firstPath(page, "/training/history", (pathname) => /^\/training\/log\/[^/]+\/done$/.test(pathname)),
  },
  {
    key: "/training/my-workouts/[id]",
    resolve: (page) => firstPath(page, "/training/my-workouts", oneSegment("/training/my-workouts", ["day"])),
  },
  {
    key: "/training/my-workouts/day/[planId]",
    resolve: (page) => firstPath(page, "/training", oneSegment("/training/my-workouts/day")),
  },
];

if (CASES.length !== 21) {
  throw new Error(`expected 21 dynamic routes, found ${CASES.length}`);
}

test.describe("dynamic", () => {
  for (const item of CASES) {
    test(`${item.key} @member`, async ({ page }, info) => {
      test.skip(Boolean(item.admin) && !process.env.RUN_ADMIN, "BLOCKED-NO-ACCESS");
      test.skip(Boolean(item.skipReason), item.skipReason);
      const url = seededPath(item.key) ?? (await item.resolve(page));
      test.skip(!url, `no seeded id for ${item.key}`);
      await exerciseRoute(page, info, item.key, url!);
    });
  }
});
