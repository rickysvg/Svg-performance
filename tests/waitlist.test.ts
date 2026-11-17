import { createElement, type ReactNode } from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { GET as exportWaitlist } from "@/app/api/admin/waitlist/export/route";
import { GET as getWaitlistApi, POST } from "@/app/api/waitlist/route";
import { GET as getWaitlistPage, HEAD as headWaitlistPage } from "@/app/waitlist/route";
import { PublicHome } from "@/components/marketing/PublicHome";
import { setMailSenderForTests, type MailInput } from "@/lib/mail";
import {
  PUBLIC_WAITLIST_REDIRECT,
  publicWaitlistRedirect,
  WAITLIST_CLOSED_MESSAGE,
} from "@/lib/public-waitlist";
import { shouldShowSplashOverlay } from "@/lib/splash";
import { getCurrentUser } from "@/lib/session";

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

const APPROVED_WEB_LINE = "Train on the web. Open it on your phone, no download needed.";
const APPROVED_APPS_LINE = "iPhone and Android apps are on the way.";

function post(body: string, ip = "203.0.113.20") {
  return POST(
    new Request("https://svgperformance.app/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body,
    }),
  );
}

describe("public waitlist redirect", () => {
  it("sends /waitlist to /register with a 308 and keeps the query string", async () => {
    const redirects = nextConfig.redirects;
    if (!redirects) throw new Error("next.config redirects() is missing");
    const rules = await redirects();
    expect(rules).toContainEqual(PUBLIC_WAITLIST_REDIRECT);
    expect(PUBLIC_WAITLIST_REDIRECT.permanent).toBe(true);
    expect(PUBLIC_WAITLIST_REDIRECT.destination).toBe("/register");
    expect(PUBLIC_WAITLIST_REDIRECT.destination).not.toContain("?");

    const target = "https://svgperformance.app/waitlist?utm_source=instagram&utm_medium=social&utm_campaign=launch";
    const redirect = publicWaitlistRedirect(target);
    expect(redirect).toEqual({
      status: 308,
      location:
        "https://svgperformance.app/register?utm_source=instagram&utm_medium=social&utm_campaign=launch",
    });

    const response = getWaitlistPage(new Request(target));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(redirect?.location);

    const head = headWaitlistPage(new Request("https://svgperformance.app/waitlist/?utm_content=bio"));
    expect(head.status).toBe(308);
    expect(head.headers.get("location")).toBe("https://svgperformance.app/register?utm_content=bio");

    const plain = getWaitlistPage(new Request("https://svgperformance.app/waitlist"));
    expect(plain.status).toBe(308);
    expect(plain.headers.get("location")).toBe("https://svgperformance.app/register");
  });
});

describe("public waitlist join is closed", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete env.MAILCHIMP_API_KEY;
    delete env.MAILCHIMP_SERVER_PREFIX;
    delete env.MAILCHIMP_AUDIENCE_ID;
    delete env.MAILCHIMP_DOUBLE_OPTIN;
    delete env.ADMIN_EMAILS;
    currentUser.mockReset();
    currentUser.mockResolvedValue(null);
    setMailSenderForTests(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setMailSenderForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 410 and inserts nothing, including when mail would have sent", async () => {
    const sent: MailInput[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: true, reason: "sent" };
    });
    const hits: string[] = [];
    vi.stubGlobal("fetch", async (url: string | URL) => {
      hits.push(String(url));
      throw new Error("mailchimp should not be called");
    });

    const body = JSON.stringify({
      firstName: "Alex",
      email: "fighter@example.com",
      train: "MMA",
      member: "Yes",
    });
    const created = await post(body);
    expect(created.status).toBe(410);
    expect(await created.json()).toEqual({ ok: false, error: WAITLIST_CLOSED_MESSAGE });

    const again = await post(body, "203.0.113.21");
    expect(again.status).toBe(410);
    const invalid = await post("{", "203.0.113.22");
    expect(invalid.status).toBe(410);
    expect((await getWaitlistApi(new Request("https://svgperformance.app/api/waitlist"))).status).toBe(410);

    expect(await prisma.waitlistSignup.count()).toBe(0);
    expect(sent).toEqual([]);
    expect(hits).toEqual([]);
  });

  it("does not add a row when one already exists", async () => {
    await prisma.waitlistSignup.create({
      data: {
        email: "already@example.com",
        firstName: "Alex",
        train: "MMA",
        member: "No",
        source: "waitlist",
      },
    });
    const response = await post(
      JSON.stringify({ firstName: "Alexis", email: "new@example.com", train: "BJJ", member: "Yes" }),
    );
    expect(response.status).toBe(410);
    expect(await prisma.waitlistSignup.count()).toBe(1);
    expect(await prisma.waitlistSignup.findUnique({ where: { email: "new@example.com" } })).toBeNull();
  });

  it("still exports the saved list for an admin", async () => {
    await prisma.waitlistSignup.create({
      data: {
        email: "export@example.com",
        firstName: "Alex",
        train: "BJJ",
        member: "Yes",
        source: "waitlist",
      },
    });
    await prisma.waitlistSignup.create({
      data: {
        email: "formula@example.com",
        firstName: "=cmd",
        train: "Boxing",
        member: "No",
        source: "waitlist",
      },
    });

    expect((await exportWaitlist()).status).toBe(401);

    const member = await makeUser("waitlist-member@example.com");
    currentUser.mockResolvedValue(member);
    expect((await exportWaitlist()).status).toBe(403);

    const admin = await makeUser("waitlist-admin@example.com", false, "admin");
    currentUser.mockResolvedValue(admin);
    const exported = await exportWaitlist();
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
    expect((await exportWaitlist()).status).toBe(200);

    const desk = readFileSync("src/app/(member)/admin/waitlist/page.tsx", "utf8");
    expect(desk).toContain('href="/api/admin/waitlist/export"');
    expect(desk).toContain("Export CSV");
    const adminHome = readFileSync("src/app/(member)/admin/page.tsx", "utf8");
    expect(adminHome).toContain('href="/admin/waitlist"');
    expect(adminHome).toContain("Export the launch list");
  });
});

describe("public waitlist links and copy", () => {
  it("has no public links to /waitlist", () => {
    const link = /href\s*=\s*(?:\{\s*)?["'`]\/waitlist(?:\?[^"'`]*)?["'`]/;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name === "admin") continue;
          walk(full);
          continue;
        }
        if (!/\.(tsx|ts|jsx|js|css|md|html|txt|json|webmanifest)$/.test(name)) continue;
        if (link.test(readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk("src");
    walk("public");
    expect(hits).toEqual([]);

    const seoNames = ["sitemap.ts", "sitemap.js", "sitemap.xml", "robots.ts", "robots.js", "robots.txt"];
    for (const name of seoNames) {
      for (const root of [".", "src", "src/app", "public"]) {
        const full = path.join(root, name);
        try {
          const text = readFileSync(full, "utf8");
          expect(text, full).not.toMatch(/\/waitlist/);
        } catch {
          // These files are not in the app. Nothing there points at /waitlist.
        }
      }
    }
  });

  it("points the public site at sign-up and keeps the approved lines", () => {
    const home = readFileSync("src/components/marketing/PublicHome.tsx", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const landing = readFileSync("src/app/page.tsx", "utf8");
    const login = readFileSync("src/app/login/page.tsx", "utf8");
    const header = readFileSync("src/components/AppHeader.tsx", "utf8");
    const register = readFileSync("src/app/register/page.tsx", "utf8");
    const pricing = readFileSync("src/app/pricing/page.tsx", "utf8");

    for (const file of [home, layout, landing, login, header, register, pricing]) {
      expect(file).not.toMatch(/href=["'`]\/waitlist/);
      expect(file.toLowerCase()).not.toContain("join the waitlist");
      expect(file.toLowerCase()).not.toContain("coming soon");
      expect(file.toLowerCase()).not.toContain("get notified");
      expect(file.toLowerCase()).not.toContain("keep me notified");
    }

    expect(home).toContain('href="/register"');
    expect(home).toContain(APPROVED_WEB_LINE);
    expect(home).toContain(APPROVED_APPS_LINE);
    expect(home).toContain("The app is live on the web.");
    expect(home).not.toMatch(/\$\d/);
    expect(home.toLowerCase()).not.toMatch(/\b(app store|google play|play store)\b/);
    expect(home.match(/download/gi)).toEqual(["download"]);

    expect(layout).toContain(APPROVED_WEB_LINE);
    expect(layout).toContain("The app is live on the web.");
    expect(layout.toLowerCase()).not.toContain("private preview");
    expect(landing).toContain(APPROVED_WEB_LINE);
    expect(login).toContain('href="/register"');
    expect(header).toContain('href="/register"');
    expect(register).toContain("Create an account");
    expect(register).not.toContain("Create a preview account");

    const html = renderToStaticMarkup(createElement(PublicHome))
      .replaceAll("&#x27;", "'")
      .replaceAll("&amp;", "&");
    expect(html).toContain('href="/register"');
    expect(html).not.toContain('href="/waitlist"');
    expect(html).toContain("Sign up");
    expect(html).toContain("Create an account");
    expect(html).toContain(APPROVED_WEB_LINE);
    expect(html).toContain(APPROVED_APPS_LINE);

    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).not.toMatch(/["']\/waitlist["']/);
    expect(shouldShowSplashOverlay({ stored: null, pathname: "/waitlist" })).toBe(false);
    expect(readFileSync("src/lib/auth.ts", "utf8")).toContain("persistUserFirstTouch");
  });
});
