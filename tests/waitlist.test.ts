import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { POST } from "@/app/api/waitlist/route";
import { GET } from "@/app/api/admin/waitlist/export/route";
import { getCurrentUser } from "@/lib/session";
import { WaitlistConfirmation } from "@/components/waitlist/WaitlistForm";
import { WaitlistLanding } from "@/app/waitlist/page";
import {
  mailchimpSubscriberHash,
  resetWaitlistRateLimitForTests,
  WAITLIST_RATE_LIMIT,
} from "@/lib/launch-waitlist";
import {
  isWaitlistLive,
  WAITLIST_ALREADY_MESSAGE,
  WAITLIST_EMAIL_ERROR,
  WAITLIST_NAME_ERROR,
  WAITLIST_RATE_MESSAGE,
  WAITLIST_WEB_LINE,
} from "@/lib/waitlist-shared";
import { shouldShowSplashOverlay } from "@/lib/splash";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) =>
    createElement("img", { alt: alt ?? "", src: src ?? "" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

const currentUser = vi.mocked(getCurrentUser);
const env = process.env as Record<string, string | undefined>;

function post(body: unknown, ip: string) {
  return POST(
    new Request("https://svgperformance.app/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

function person(email: string, extra: Record<string, unknown> = {}) {
  return { firstName: "Alex", email, train: "MMA", member: "No", ...extra };
}

type Hit = { url: string; method: string; body?: string; auth: string };

function installFetch(handler: (hit: Hit) => Response) {
  const hits: Hit[] = [];
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const hit: Hit = {
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body == null ? undefined : String(init.body),
      auth: new Headers(init?.headers).get("authorization") ?? "",
    };
    hits.push(hit);
    return handler(hit);
  });
  return hits;
}

function useMailchimp(doubleOptIn = false) {
  env.MAILCHIMP_API_KEY = "test-key-not-real";
  env.MAILCHIMP_SERVER_PREFIX = "us21";
  env.MAILCHIMP_AUDIENCE_ID = "abc123def4";
  if (doubleOptIn) env.MAILCHIMP_DOUBLE_OPTIN = "true";
  else delete env.MAILCHIMP_DOUBLE_OPTIN;
}

describe("waitlist", () => {
  beforeEach(async () => {
    await resetDatabase();
    resetWaitlistRateLimitForTests();
    delete env.MAILCHIMP_API_KEY;
    delete env.MAILCHIMP_SERVER_PREFIX;
    delete env.MAILCHIMP_AUDIENCE_ID;
    delete env.MAILCHIMP_DOUBLE_OPTIN;
    delete env.ADMIN_EMAILS;
    currentUser.mockReset();
    currentUser.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a missing name and a bad email", async () => {
    const missing = await post({ email: "alex@example.com" }, "203.0.113.1");
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ ok: false, error: WAITLIST_NAME_ERROR });

    const bad = await post({ firstName: "Alex", email: "not-an-email" }, "203.0.113.2");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: WAITLIST_EMAIL_ERROR });

    const discipline = await post(
      person("alex@example.com", { train: "Karate" }),
      "203.0.113.3",
    );
    expect(discipline.status).toBe(400);
    expect(await prisma.waitlistSignup.count()).toBe(0);
  });

  it("stores a signup when Mailchimp is not configured and defaults member to No", async () => {
    const response = await post(
      { firstName: "  Alex  ", email: "Fighter@Example.com", train: "Muay Thai" },
      "203.0.113.4",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "subscribed",
      firstName: "Alex",
    });
    const row = await prisma.waitlistSignup.findUnique({ where: { email: "fighter@example.com" } });
    expect(row?.firstName).toBe("Alex");
    expect(row?.train).toBe("Muay Thai");
    expect(row?.member).toBe("No");
    expect(row?.source).toBe("waitlist");
  });

  it("stores Yes when the academy toggle is on", async () => {
    const response = await post(person("member@example.com", { member: "Yes" }), "203.0.113.5");
    expect(response.status).toBe(200);
    const row = await prisma.waitlistSignup.findUnique({ where: { email: "member@example.com" } });
    expect(row?.member).toBe("Yes");
  });

  it("tells a duplicate they are already on the list", async () => {
    expect((await post(person("alex@example.com"), "203.0.113.6")).status).toBe(200);
    const again = await post(person("Alex@Example.com", { firstName: "Alexis" }), "203.0.113.6");
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ ok: false, error: WAITLIST_ALREADY_MESSAGE });
    expect(await prisma.waitlistSignup.count()).toBe(1);
    expect((await prisma.waitlistSignup.findFirst())?.firstName).toBe("Alex");
  });

  it("drops a filled honeypot without storing it", async () => {
    const hits = installFetch(() => {
      throw new Error("mailchimp should not be called");
    });
    useMailchimp();
    const response = await post(
      person("bot@example.com", { svg_hp: "https://spam.example" }),
      "203.0.113.7",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(await prisma.waitlistSignup.count()).toBe(0);
    expect(hits).toHaveLength(0);
  });

  it("rate-limits an address after repeated tries", async () => {
    for (let i = 0; i < WAITLIST_RATE_LIMIT; i += 1) {
      const response = await post(person(`rate-${i}@example.com`), "203.0.113.8");
      expect(response.status).toBe(200);
    }
    const blocked = await post(person("rate-over@example.com"), "203.0.113.8");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ ok: false, error: WAITLIST_RATE_MESSAGE });
    expect(await prisma.waitlistSignup.count()).toBe(WAITLIST_RATE_LIMIT);
  });

  it("subscribes through Mailchimp and keeps a backup row", async () => {
    useMailchimp();
    const hits = installFetch((hit) => {
      if (hit.url.endsWith("/tags")) return new Response(null, { status: 204 });
      if (hit.method === "PUT") return new Response("{}", { status: 200 });
      return new Response("{}", { status: 404 });
    });

    const response = await post(
      { firstName: "Alex", email: "Fighter@Example.com", train: "MMA", member: "Yes" },
      "203.0.113.9",
    );
    expect(response.status).toBe(200);

    const hash = mailchimpSubscriberHash("fighter@example.com");
    const memberUrl = `https://us21.api.mailchimp.com/3.0/lists/abc123def4/members/${hash}`;
    const put = hits.find((hit) => hit.method === "PUT");
    expect(put?.url).toBe(memberUrl);
    expect(JSON.parse(put?.body ?? "{}")).toEqual({
      email_address: "fighter@example.com",
      status_if_new: "subscribed",
      merge_fields: { FNAME: "Alex", TRAIN: "MMA", MEMBER: "Yes" },
    });
    expect(Buffer.from(put?.auth.replace(/^Basic /, "") ?? "", "base64").toString()).toBe(
      "svg:test-key-not-real",
    );
    const tag = hits.find((hit) => hit.url.endsWith("/tags"));
    expect(tag?.method).toBe("POST");
    expect(JSON.parse(tag?.body ?? "{}")).toEqual({
      tags: [{ name: "waitlist", status: "active" }],
    });
    expect(await prisma.waitlistSignup.count()).toBe(1);
  });

  it("uses pending when double opt-in is on", async () => {
    useMailchimp(true);
    const hits = installFetch((hit) => {
      if (hit.url.endsWith("/tags")) return new Response(null, { status: 204 });
      if (hit.method === "PUT") return new Response("{}", { status: 200 });
      return new Response("{}", { status: 404 });
    });
    expect((await post(person("optin@example.com"), "203.0.113.10")).status).toBe(200);
    const put = hits.find((hit) => hit.method === "PUT");
    expect(JSON.parse(put?.body ?? "{}").status_if_new).toBe("pending");
  });

  it("still confirms when Mailchimp fails and stores the backup", async () => {
    useMailchimp();
    installFetch((hit) => {
      if (hit.method === "PUT") return new Response("down", { status: 500 });
      return new Response("{}", { status: 404 });
    });
    const response = await post(person("fallback@example.com"), "203.0.113.11");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "subscribed" });
    const row = await prisma.waitlistSignup.findUnique({ where: { email: "fallback@example.com" } });
    expect(row?.firstName).toBe("Alex");
    expect(row?.member).toBe("No");
  });

  it("treats an existing Mailchimp member as already on the list and still backs them up", async () => {
    useMailchimp();
    const hits = installFetch((hit) => {
      if (hit.method === "GET") {
        return new Response(JSON.stringify({ status: "subscribed" }), { status: 200 });
      }
      if (hit.url.endsWith("/tags")) return new Response(null, { status: 204 });
      throw new Error(`unexpected ${hit.method}`);
    });
    const response = await post(person("exists@example.com"), "203.0.113.12");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: WAITLIST_ALREADY_MESSAGE });
    expect(hits.some((hit) => hit.method === "PUT")).toBe(false);
    expect(await prisma.waitlistSignup.findUnique({ where: { email: "exists@example.com" } })).toBeTruthy();
  });

  it("keeps a local duplicate off Mailchimp", async () => {
    expect((await post(person("local@example.com"), "203.0.113.13")).status).toBe(200);
    useMailchimp();
    const hits = installFetch(() => {
      throw new Error("should not call Mailchimp");
    });
    const again = await post(person("local@example.com"), "203.0.113.14");
    expect(again.status).toBe(409);
    expect(hits).toHaveLength(0);
  });

  it("exports CSV for an admin and refuses everyone else", async () => {
    expect((await post(person("export@example.com", { train: "BJJ", member: "Yes" }), "203.0.113.15")).status).toBe(
      200,
    );
    await prisma.waitlistSignup.create({
      data: {
        email: "formula@example.com",
        firstName: "=cmd",
        train: "Boxing",
        member: "No",
        source: "waitlist",
      },
    });

    expect((await GET()).status).toBe(401);

    const member = await makeUser("waitlist-member@example.com");
    currentUser.mockResolvedValue(member);
    expect((await GET()).status).toBe(403);

    const admin = await makeUser("waitlist-admin@example.com", false, "admin");
    currentUser.mockResolvedValue(admin);
    const exported = await GET();
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toContain("text/csv");
    expect(exported.headers.get("content-disposition")).toContain("waitlist-signups.csv");
    const csv = await exported.text();
    expect(csv).toContain("email,first_name,train,member,created_at,source");
    expect(csv).toContain("export@example.com");
    expect(csv).toContain("BJJ");
    expect(csv).toContain("Yes");
    expect(csv).toContain("'=cmd");

    const reviewer = await makeUser("ricky-waitlist@example.com");
    env.ADMIN_EMAILS = "ricky-waitlist@example.com";
    currentUser.mockResolvedValue(reviewer);
    expect((await GET()).status).toBe(200);
  });

  it("keeps /waitlist public and uses the page copy", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).not.toMatch(/["']\/waitlist["']/);
    expect(shouldShowSplashOverlay({ stored: null, pathname: "/waitlist" })).toBe(false);

    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain("MAILCHIMP_API_KEY=");
    expect(example).toContain("MAILCHIMP_SERVER_PREFIX=");
    expect(example).toContain("MAILCHIMP_AUDIENCE_ID=");
    expect(example).toContain("MAILCHIMP_DOUBLE_OPTIN=");

    const pages = [
      "src/app/waitlist/page.tsx",
      "src/components/waitlist/WaitlistForm.tsx",
      "src/lib/waitlist-shared.ts",
      "src/app/(member)/admin/waitlist/page.tsx",
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(pages).not.toMatch(/\$\d/);
    expect(pages.toLowerCase()).not.toContain("trial");
    expect(pages.toLowerCase()).not.toContain("price");
    expect(pages).not.toContain("What will it cost");
    expect(pages).not.toContain("FOR REVIEW");
    expect(pages.match(/download/gi)).toEqual(["download"]);
    expect(pages).toContain(WAITLIST_WEB_LINE);

    const html = renderToStaticMarkup(createElement(WaitlistLanding))
      .replaceAll("&#x27;", "'")
      .replaceAll("&amp;", "&");
    expect(html).toContain("BUILT AT SVG MMA ACADEMY · LAUNCHING NOV 16");
    expect(html).toContain("Be ");
    expect(html).toContain("first");
    expect(html).toContain("Nov 16");
    expect(html).toContain(
      "Fighter-first training built around your class and sparring days: RIR-based S&C, themed bag rounds and five AI coaches in your corner. Get on the list and you're the first to know when it drops on ",
    );
    expect(html).toContain(">Monday, Nov 16<");
    expect(html).toContain("JOIN THE WAITLIST");
    expect(html).toContain("First name");
    expect(html).toContain("you@email.com");
    expect(html).toContain("What do you train?");
    expect(html).toContain("Muay Thai");
    expect(html).toContain("Do you train at SVG MMA Academy?");
    expect(html).toContain("Your app account links to your membership automatically through Gymdesk.");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("We only use your email for SVG Performance launch and training updates.");
    expect(html).toContain("What's in the app?");
    expect(html).toContain("Do I have to train at SVG?");
    expect(html).toContain("Who are the AI coaches?");
    expect(html).toContain("Book with Ricky");
    expect(html).toContain("iPhone and Android apps are on the way.");
    expect(html).toContain("Know someone grinding without a plan? Send them this page.");
    expect(html).not.toContain("What will it cost");
    expect(html).not.toContain("$");
    expect(html).not.toContain("START TRAINING TODAY");

    const quiet = renderToStaticMarkup(
      createElement(WaitlistConfirmation, { firstName: "Alex", live: false }),
    ).replaceAll("&#x27;", "'");
    expect(quiet).toContain("You're in, Alex. Stay ready.");
    expect(quiet).toContain("You\u2019re on the list. When SVG Performance drops on ");
    expect(quiet).toContain("Monday, Nov 16");
    expect(quiet).toContain("you\u2019ll be first to know. Check your inbox for Ricky\u2019s welcome.");
    expect(quiet).not.toContain("START TRAINING TODAY");

    const live = renderToStaticMarkup(
      createElement(WaitlistConfirmation, { firstName: "Alex", live: true }),
    ).replaceAll("&#x27;", "'");
    expect(live).toContain("START TRAINING TODAY");
    expect(live).toContain('href="/register"');
    expect(live).toContain(WAITLIST_WEB_LINE);

    expect(isWaitlistLive(new Date("2026-11-15T23:30:00-05:00"))).toBe(false);
    expect(isWaitlistLive(new Date("2026-11-16T00:30:00-05:00"))).toBe(true);

    const desk = readFileSync("src/app/(member)/admin/page.tsx", "utf8");
    expect(desk).toContain('href="/admin/waitlist"');
    expect(desk).toContain("Export the launch list");
  });
});
