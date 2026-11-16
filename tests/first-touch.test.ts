import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerAccount } from "@/lib/auth";
import {
  ATTRIBUTION_LIMITS,
  FIRST_TOUCH_BOOT_SCRIPT,
  FIRST_TOUCH_COOKIE,
  FIRST_TOUCH_MAX_AGE_SECONDS,
  buildFirstTouch,
  captureFirstTouchFromLocation,
  externalReferrer,
  firstTouchSetCookie,
  parseStoredFirstTouch,
  readCookieValue,
  resolveFirstTouch,
  serializeFirstTouch,
} from "@/lib/first-touch";
import { saveUserFirstTouch, saveWaitlistFirstTouch } from "@/lib/first-touch-store";

const NOW = new Date("2026-11-16T15:00:00.000Z");
const LATER = new Date("2026-11-16T15:04:00.000Z");
const INSTAGRAM =
  "utm_source=instagram&utm_medium=social&utm_campaign=launch_nov16&utm_content=bio";
const WAITLIST_LINK = "utm_source=waitlist&utm_medium=web";

const PAIRS = [
  ["mailchimp", "email"],
  ["instagram", "social"],
  ["facebook", "social"],
  ["tiktok", "social"],
  ["academy", "referral"],
  ["partner", "referral"],
  ["waitlist", "web"],
] as const;

function runBoot(input: {
  href: string;
  protocol?: string;
  referrer?: string;
  cookie?: string;
}): { assigned: string | null; cookie: string } {
  let assigned: string | null = null;
  const jar = { value: input.cookie ?? "" };
  const document = {
    referrer: input.referrer ?? "",
    get cookie() {
      return jar.value;
    },
    set cookie(next: string) {
      assigned = next;
      jar.value = next.split(";")[0] ?? next;
    },
  };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    JSON,
    Date,
    document,
    location: { href: input.href, protocol: input.protocol ?? "https:" },
  });
  vm.runInContext(FIRST_TOUCH_BOOT_SCRIPT, context, { timeout: 1000 });
  return { assigned, cookie: jar.value };
}

function cookieRecord(setCookie: string) {
  const pair = setCookie.split(";")[0] ?? "";
  const raw = readCookieValue(pair, FIRST_TOUCH_COOKIE);
  const record = parseStoredFirstTouch(raw, new Date());
  expect(record).not.toBeNull();
  return record!;
}

describe("first-touch parsing", () => {
  it("stores launch tags as given, including content, and drops non-strings", () => {
    for (const [source, medium] of PAIRS) {
      const record = buildFirstTouch({
        search: `utm_source=${source}&utm_medium=${medium}&utm_campaign=launch_nov16&utm_content=bio&utm_term=fighters`,
        pageUrl: "https://svgperformance.app/",
        now: NOW,
      });
      expect(record).toMatchObject({
        utmSource: source,
        utmMedium: medium,
        utmCampaign: "launch_nov16",
        utmContent: "bio",
        utmTerm: "fighters",
        landingPath: "/",
        firstTouchAt: NOW.toISOString(),
      });
    }

    expect(
      buildFirstTouch({
        search: {
          utm_source: 12,
          utm_medium: { social: true },
          utm_campaign: ["launch_nov16"],
          utm_content: "bio",
          utm_term: null,
        },
        pageUrl: "https://svgperformance.app/",
        now: NOW,
      }),
    ).toBeNull();
    expect(
      buildFirstTouch({
        search: "utm_content=bio&utm_term=fighters",
        pageUrl: "https://svgperformance.app/register",
        now: NOW,
      }),
    ).toBeNull();
  });

  it("truncates long values and strips control characters", () => {
    const record = buildFirstTouch({
      search: `utm_source=${"a".repeat(180)}&utm_medium=${"so\n\r\u0000cial"}`,
      pageUrl: `https://svgperformance.app/${"p".repeat(240)}`,
      now: NOW,
    });
    expect(record?.utmSource).toHaveLength(ATTRIBUTION_LIMITS.utm);
    expect(record?.utmMedium).toBe("social");
    expect(record?.landingPath?.length).toBeLessThanOrEqual(ATTRIBUTION_LIMITS.landingPath);
    expect(record?.landingPath?.startsWith("/")).toBe(true);
  });

  it("keeps referrer origin and path only, and ignores this site's hosts", () => {
    expect(
      externalReferrer(
        "https://l.instagram.com/reel/abc?igsh=secret&utm_source=ig#story",
        "https://svgperformance.app/?utm_source=instagram",
      ),
    ).toBe("https://l.instagram.com/reel/abc");
    expect(
      externalReferrer("https://www.google.com/search?q=svg+mma#top", "https://svgperformance.app/waitlist"),
    ).toBe("https://www.google.com/search");

    expect(
      externalReferrer(
        "https://svgperformance.app/waitlist?utm_source=waitlist&utm_medium=web#form",
        "https://svg-performance.vercel.app/register",
      ),
    ).toBeNull();
    expect(
      externalReferrer("https://svg-performance.vercel.app/pricing?x=1", "https://svgperformance.app/"),
    ).toBeNull();
    expect(
      externalReferrer("https://svgperformance.app/pricing?x=1", "https://svgperformance.app/register"),
    ).toBeNull();
    expect(externalReferrer("http://localhost:3000/waitlist?x=1", "http://localhost:3000/register")).toBeNull();
    expect(externalReferrer("", "https://svgperformance.app/")).toBeNull();
    expect(externalReferrer(12, "https://svgperformance.app/")).toBeNull();

    const record = buildFirstTouch({
      search: "",
      referrer: "https://l.instagram.com/?u=private",
      pageUrl: "https://svg-performance.vercel.app/waitlist",
      now: NOW,
    });
    expect(record).toMatchObject({
      utmSource: null,
      referrer: "https://l.instagram.com/",
      landingPath: "/waitlist",
    });
    expect(serializeFirstTouch(record!)).not.toContain("private");
    expect(serializeFirstTouch(record!)).not.toContain("?");
  });

  it("keeps instagram/social when a later visit is the waitlist web link", () => {
    const first = resolveFirstTouch({
      search: INSTAGRAM,
      referrer: "https://l.instagram.com/reel/abc?igsh=secret#x",
      pageUrl: `https://svgperformance.app/?${INSTAGRAM}`,
      now: NOW,
    });
    expect(first.action).toBe("write");
    if (first.action !== "write") return;
    expect(first.record).toMatchObject({
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "launch_nov16",
      utmContent: "bio",
      referrer: "https://l.instagram.com/reel/abc",
      landingPath: "/",
    });

    const stored = serializeFirstTouch(first.record);
    const second = resolveFirstTouch({
      search: WAITLIST_LINK,
      referrer: "https://svgperformance.app/waitlist?utm_source=waitlist&utm_medium=web",
      pageUrl: `https://svgperformance.app/register?${WAITLIST_LINK}`,
      existing: stored,
      now: LATER,
    });
    expect(second.action).toBe("keep");
    if (second.action !== "keep") return;
    expect(second.record.utmSource).toBe("instagram");
    expect(second.record.utmMedium).toBe("social");
    expect(second.record.utmCampaign).toBe("launch_nov16");
    expect(second.record.utmContent).toBe("bio");
    expect(second.record.landingPath).toBe("/");
    expect(second.record.utmTerm).toBeNull();

    const richer = resolveFirstTouch({
      search: `${INSTAGRAM}&utm_term=fighters`,
      pageUrl: "https://svg-performance.vercel.app/",
      existing: encodeURIComponent(stored),
      now: LATER,
    });
    expect(richer.action).toBe("keep");
    if (richer.action !== "keep") return;
    expect(richer.record.utmTerm).toBeNull();
    expect(richer.record.utmSource).toBe("instagram");
  });

  it("still records waitlist/web when that link is the first visit", () => {
    const decision = resolveFirstTouch({
      search: WAITLIST_LINK,
      referrer: "https://svgperformance.app/",
      pageUrl: `https://svgperformance.app/register?${WAITLIST_LINK}`,
      now: NOW,
    });
    expect(decision.action).toBe("write");
    if (decision.action !== "write") return;
    expect(decision.record.utmSource).toBe("waitlist");
    expect(decision.record.utmMedium).toBe("web");
    expect(decision.record.referrer).toBeNull();
    expect(decision.record.landingPath).toBe("/register");
  });

  it("replaces a touch only after the 30-day cookie has expired", () => {
    const first = buildFirstTouch({
      search: "utm_source=instagram&utm_medium=social",
      pageUrl: "https://svgperformance.app/",
      now: NOW,
    });
    expect(first).not.toBeNull();
    const almost = new Date(NOW.getTime() + FIRST_TOUCH_MAX_AGE_SECONDS * 1000 - 1000);
    expect(
      resolveFirstTouch({
        search: WAITLIST_LINK,
        pageUrl: "https://svgperformance.app/register",
        existing: serializeFirstTouch(first!),
        now: almost,
      }).action,
    ).toBe("keep");
    const expired = new Date(NOW.getTime() + FIRST_TOUCH_MAX_AGE_SECONDS * 1000 + 1000);
    const again = resolveFirstTouch({
      search: WAITLIST_LINK,
      pageUrl: "https://svgperformance.app/register",
      existing: serializeFirstTouch(first!),
      now: expired,
    });
    expect(again.action).toBe("write");
    if (again.action !== "write") return;
    expect(again.record.utmSource).toBe("waitlist");
    expect(again.record.utmMedium).toBe("web");
  });

  it("sets a host-only cookie and the early script does not overwrite instagram", () => {
    const captured = captureFirstTouchFromLocation({
      href: `https://svgperformance.app/?${INSTAGRAM}`,
      referrer: "https://l.instagram.com/reel/abc?igsh=secret",
      cookieHeader: "",
      secure: true,
      now: NOW,
    });
    expect(captured.cookie).toBeTruthy();
    expect(captured.cookie?.toLowerCase()).not.toContain("domain=");
    expect(captured.cookie).toContain("Path=/");
    expect(captured.cookie).toContain(`Max-Age=${FIRST_TOUCH_MAX_AGE_SECONDS}`);
    expect(captured.cookie).toContain("SameSite=Lax");
    expect(captured.cookie).toContain("Secure");
    expect(
      firstTouchSetCookie(captured.record!, false).includes("Secure"),
    ).toBe(false);

    const header = captured.cookie!.split(";")[0] ?? "";
    const second = captureFirstTouchFromLocation({
      href: `https://svgperformance.app/register?${WAITLIST_LINK}`,
      referrer: "https://svg-performance.vercel.app/waitlist?utm_source=waitlist",
      cookieHeader: header,
      secure: true,
      now: LATER,
    });
    expect(second.cookie).toBeNull();
    expect(second.record?.utmSource).toBe("instagram");
    expect(second.record?.utmMedium).toBe("social");

    const firstBoot = runBoot({
      href: `https://svgperformance.app/?${INSTAGRAM}`,
      referrer: "https://l.instagram.com/reel/abc?igsh=secret#x",
    });
    expect(typeof firstBoot.assigned).toBe("string");
    if (typeof firstBoot.assigned !== "string") return;
    expect(firstBoot.assigned.toLowerCase()).not.toContain("domain=");
    const fromScript = cookieRecord(firstBoot.assigned);
    expect(fromScript).toMatchObject({
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "launch_nov16",
      utmContent: "bio",
      referrer: "https://l.instagram.com/reel/abc",
      landingPath: "/",
    });

    const secondBoot = runBoot({
      href: `https://svgperformance.app/register?${WAITLIST_LINK}`,
      referrer: "https://svgperformance.app/waitlist?utm_source=waitlist&utm_medium=web",
      cookie: firstBoot.cookie,
    });
    expect(secondBoot.assigned).toBeNull();
    expect(cookieRecord(secondBoot.cookie).utmSource).toBe("instagram");
    expect(cookieRecord(secondBoot.cookie).utmMedium).toBe("social");

    const crossHost = runBoot({
      href: "https://svg-performance.vercel.app/register",
      referrer: "https://svgperformance.app/waitlist?utm_source=waitlist&utm_medium=web#go",
    });
    expect(crossHost.assigned).toBeNull();
  });

  it("mounts capture on the root layout and keeps the migration additive", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("FirstTouchCapture");
    expect(layout).toContain("FIRST_TOUCH_BOOT_SCRIPT");
    expect(layout).toContain('id="first-touch"');
    expect(FIRST_TOUCH_BOOT_SCRIPT).not.toMatch(/domain\s*=/i);

    const migration = readFileSync(
      "prisma/migrations/20261116060000_signup_first_touch/migration.sql",
      "utf8",
    );
    expect(migration.toUpperCase()).not.toMatch(/\bDROP\b/);
    expect(migration).toContain('ADD COLUMN "utmSource" TEXT');
    expect(migration).toContain('ADD COLUMN "first_touch_at" DATETIME');
    const hosted = readFileSync("prisma/hosted-additive.sql", "utf8");
    expect(hosted).toContain('ADD COLUMN "utmSource" TEXT');
    expect(hosted).toContain('ADD COLUMN "utm_source" TEXT');
    expect(hosted).toContain('ADD COLUMN "firstTouchAt" TIMESTAMP(3)');
    expect(hosted).toContain('ADD COLUMN "first_touch_at" TIMESTAMP(3)');
    expect(hosted.toUpperCase()).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/);
    expect(readFileSync("scripts/prisma-prepare.mjs", "utf8")).not.toContain("--accept-data-loss");
  });
});

describe("first-touch persistence", () => {
  it("saves instagram on the user and waitlist row and does not overwrite it", async () => {
    const user = await registerAccount({
      email: "first-touch-user@example.com",
      password: "password12",
      displayName: "First",
      isAdultConfirmed: true,
      claimsGymMembership: false,
    });
    const instagram = buildFirstTouch({
      search: INSTAGRAM,
      referrer: "https://l.instagram.com/reel/abc?igsh=secret",
      pageUrl: "https://svgperformance.app/",
      now: NOW,
    });
    const waitlistTouch = buildFirstTouch({
      search: WAITLIST_LINK,
      pageUrl: "https://svgperformance.app/register",
      now: LATER,
    });
    expect(instagram).not.toBeNull();
    expect(waitlistTouch).not.toBeNull();

    await saveUserFirstTouch(user.id, instagram!);
    await saveUserFirstTouch(user.id, waitlistTouch!);
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile?.utmSource).toBe("instagram");
    expect(profile?.utmMedium).toBe("social");
    expect(profile?.utmCampaign).toBe("launch_nov16");
    expect(profile?.utmContent).toBe("bio");
    expect(profile?.referrer).toBe("https://l.instagram.com/reel/abc");
    expect(profile?.landingPath).toBe("/");
    expect(profile?.firstTouchAt?.toISOString()).toBe(NOW.toISOString());

    await prisma.waitlistSignup.create({
      data: {
        email: "first-touch-waitlist@example.com",
        firstName: "Ada",
        source: "waitlist",
      },
    });
    await saveWaitlistFirstTouch("first-touch-waitlist@example.com", instagram!);
    await saveWaitlistFirstTouch("first-touch-waitlist@example.com", waitlistTouch!);
    const row = await prisma.waitlistSignup.findUnique({
      where: { email: "first-touch-waitlist@example.com" },
    });
    expect(row?.utmSource).toBe("instagram");
    expect(row?.utmMedium).toBe("social");
    expect(row?.source).toBe("waitlist");

    await expect(saveUserFirstTouch("missing-user", instagram!)).resolves.toBeUndefined();
  });
});
