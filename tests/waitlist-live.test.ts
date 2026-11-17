import { readFileSync, readdirSync, statSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { POST as joinWaitlist } from "@/app/api/waitlist/route";
import { GET, POST } from "@/app/api/admin/waitlist/live/route";
import { GET as previewLive } from "@/app/api/admin/waitlist/live/preview/route";
import { runWaitlistLiveEmailAction } from "@/app/actions/waitlist-live";
import { getCurrentUser } from "@/lib/session";
import { resetWaitlistRateLimitForTests } from "@/lib/launch-waitlist";
import { setMailSenderForTests, type MailInput } from "@/lib/mail";
import { SUPPORT_EMAIL_FALLBACK } from "@/lib/support";
import { WAITLIST_EMAIL_ERROR } from "@/lib/waitlist-shared";
import {
  buildWaitlistWelcomeEmail,
  WAITLIST_PREHEADER_PAD,
  WAITLIST_WELCOME_ADDRESS,
  WAITLIST_WELCOME_REASON,
  WAITLIST_WELCOME_SUBJECT,
} from "@/lib/waitlist-welcome";
import {
  buildWaitlistLiveEmail,
  sendWaitlistLiveEmail,
  WAITLIST_LIVE_CTA_URL,
  WAITLIST_LIVE_LINK_URL,
  WAITLIST_LIVE_REGISTER_LABEL,
  WAITLIST_LIVE_LOGO_URL,
  WAITLIST_LIVE_PREHEADER,
  WAITLIST_LIVE_PRIVACY_URL,
  WAITLIST_LIVE_SUBJECT,
} from "@/lib/waitlist-live";
import {
  runWaitlistLiveEmail,
  setWaitlistLiveTimingForTests,
  WAITLIST_LIVE_BATCH_SIZE,
  WAITLIST_LIVE_GAP_MS,
} from "@/lib/waitlist-live-run";

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

const currentUser = vi.mocked(getCurrentUser);
const env = process.env as Record<string, string | undefined>;
const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SUPPORT_EMAIL"] as const;
const smtpSnapshot = Object.fromEntries(smtpKeys.map((key) => [key, env[key]])) as Record<
  (typeof smtpKeys)[number],
  string | undefined
>;

const UTM = "utm_source=waitlist&utm_medium=email&utm_campaign=launch_nov16";
const INSIDE = [
  ["Training plans built for fighters", "Fight-specific strength and conditioning. The work fits the fight."],
  ["Logger with a rest timer", "A between-sets logger with a rest timer, built for the gym."],
  ["AI coach", "A coach in your corner when you need a read on the work."],
  ["Mobility", "Stay loose and ready to train."],
  ["Calendar", "Set your training days. Move a session when the week changes."],
] as const;
const STEPS = [
  ["01 Create your account", "Open svgperformance.app and sign up."],
  ["02 Set your days", "Tell it when you train and spar. Your week stays around mat time."],
  ["03 Start the work", "Open today's session, start the timer, and log what you did."],
] as const;

function restoreSmtp() {
  for (const key of smtpKeys) {
    const value = smtpSnapshot[key];
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  setMailSenderForTests(null);
}

function useSmtp() {
  env.SMTP_HOST = "smtp.resend.com";
  env.SMTP_PORT = "465";
  env.SMTP_USER = "resend";
  env.SMTP_FROM = "SVG Performance <no-reply@svgmmaacademy.com>";
  delete env.SMTP_PASS;
  delete env.SUPPORT_EMAIL;
}

function styleBlock(html: string) {
  return html.match(/<style type="text\/css">[\s\S]*?<\/style>/)?.[0] ?? "";
}

function assertCopyRules(value: string) {
  expect(value).not.toMatch(/\$/);
  expect(value.toLowerCase()).not.toContain("trial");
  expect(value.toLowerCase()).not.toContain("price");
  expect(value.toLowerCase()).not.toMatch(/\b(app store|google play|play store)\b/);
  expect(value.toLowerCase()).not.toContain("nov 16");
  expect(value.toLowerCase()).not.toContain("november");
  expect(value).not.toContain("*|");
  expect(value.toLowerCase().match(/download/g)).toEqual(["download"]);
  expect(value).toContain("Train on the web. Open it on your phone, no download needed.");
  expect(value).toContain("iPhone and Android apps are on the way. We'll email you when they're ready.");
}

function liveRequest(path: string, init?: RequestInit) {
  return new Request(`https://svgperformance.app${path}`, init);
}

describe("waitlist live template", () => {
  afterEach(() => {
    restoreSmtp();
  });

  it("uses the signup name, and falls back when it is empty", () => {
    const named = buildWaitlistLiveEmail("  Ricky  ");
    expect(named.subject).toBe(WAITLIST_LIVE_SUBJECT);
    expect(named.subject).toBe("We're live. Get to work.");
    expect(named.preheader).toBe(WAITLIST_LIVE_PREHEADER);
    expect(named.preheader).toBe("You waited. You're first. Let's work.");
    expect(named.text.startsWith("Hey Ricky,")).toBe(true);
    expect(named.html).toContain("Hey Ricky,");
    expect(named.html).not.toContain("Hey fighter,");

    for (const blank of ["", "   ", "\n\t"]) {
      const mail = buildWaitlistLiveEmail(blank);
      expect(mail.text.startsWith("Hey fighter,")).toBe(true);
      expect(mail.html).toContain("Hey fighter,");
      expect(mail.html).not.toContain("Hey ,");
    }
  });

  it("escapes the first name in html and keeps it literal in plain text", () => {
    const name = `Sam <script>alert("x")</script> & Co`;
    const mail = buildWaitlistLiveEmail(name);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Hey Sam &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co,");
    expect(mail.text).toContain(`Hey ${name},`);
    expect(mail.text).not.toContain("&lt;");
  });

  it("matches the welcome shell, copy, and tracked links", () => {
    const mail = buildWaitlistLiveEmail("Ricky");
    const welcome = buildWaitlistWelcomeEmail("Ricky");
    expect(mail.replyTo).toBe(SUPPORT_EMAIL_FALLBACK);
    expect(mail.replyTo).toBe("support@svgperformance.app");
    expect(styleBlock(mail.html)).toBe(styleBlock(welcome.html));
    expect(styleBlock(mail.html)).toContain("@media (prefers-color-scheme: dark)");
    expect(styleBlock(mail.html)).toContain("[data-ogsc] .btn a, [data-ogsc] .btn-text { color: #14180a !important; }");
    expect(mail.html).toContain(WAITLIST_PREHEADER_PAD);
    expect(mail.html).toContain(WAITLIST_LIVE_PREHEADER);
    expect(welcome.html).toContain(WAITLIST_PREHEADER_PAD);
    expect(mail.html).toContain("background-color:#07080a");
    expect(mail.html).toContain("background-color:#000000");
    expect(mail.html).toContain("background-color:#121418");
    expect(mail.html).toContain("border-left:4px solid #CBF805");
    expect(mail.html).toContain("#CBF805");
    expect(mail.html).toContain("color:#14180a");
    expect(mail.html).toContain("font-weight:400");
    expect(mail.html).not.toMatch(/font-weight:\s*(700|bold)/i);
    expect(mail.html).not.toMatch(/<(strong|b)\b/i);
    expect(mail.html).toContain("Anton, Impact");
    expect(mail.html).toContain("fonts.googleapis.com/css2?family=Anton");
    expect(mail.html.match(/<img\b/g)).toHaveLength(1);
    expect(mail.html).toContain('src="https://svgperformance.app/svg-performance-badge-mark.png"');
    expect(mail.html).toContain('width="180"');
    expect(mail.html).toContain('height="180"');
    expect(mail.html).toContain("We're live.<br />Get to work.");
    expect(mail.html).toContain("Built at SVG MMA Academy");
    expect(mail.html).toContain("What's inside");
    expect(mail.html).toContain("How to get started");
    for (const [title, body] of [...INSIDE, ...STEPS]) {
      expect(mail.html).toContain(title);
      expect(mail.html).toContain(body);
      expect(mail.text).toContain(title);
      expect(mail.text).toContain(body);
    }
    expect(mail.html).toContain(">Start training<");
    expect(WAITLIST_LIVE_CTA_URL).toBe(
      `https://svgperformance.app/register?${UTM}&utm_content=live_cta`,
    );
    expect(WAITLIST_LIVE_LINK_URL).toBe(
      `https://svgperformance.app/register?${UTM}&utm_content=live_link`,
    );
    expect(WAITLIST_LIVE_REGISTER_LABEL).toBe("https://svgperformance.app/register");
    expect(mail.html).toContain(`href="${WAITLIST_LIVE_CTA_URL.replaceAll("&", "&amp;")}"`);
    expect(mail.html).toContain(`href="${WAITLIST_LIVE_LINK_URL.replaceAll("&", "&amp;")}"`);
    expect(mail.html).toContain(`>${WAITLIST_LIVE_REGISTER_LABEL}<`);
    expect(mail.html).not.toContain("/login");
    expect(mail.text).not.toContain("/login");
    expect(mail.text).toContain(
      "If the button does not open, use this link: https://svgperformance.app/register",
    );
    expect(mail.html).toContain(`href="${WAITLIST_LIVE_LOGO_URL.replaceAll("&", "&amp;")}"`);
    expect(mail.html).toContain(`href="${WAITLIST_LIVE_PRIVACY_URL.replaceAll("&", "&amp;")}"`);
    expect(mail.html).toContain(UTM.replaceAll("&", "&amp;"));
    expect(mail.text).toContain(WAITLIST_LIVE_CTA_URL);
    expect(mail.text).toContain(WAITLIST_LIVE_LINK_URL);
    expect(mail.text).toContain(WAITLIST_LIVE_PRIVACY_URL);
    expect(mail.text).toContain(`${UTM}&utm_content=live_cta`);
    expect(mail.text).toContain(`${UTM}&utm_content=live_link`);
    expect(mail.text).toContain(`${UTM}&utm_content=live_privacy`);
    expect(mail.html).toContain("Coach Ricky");
    expect(mail.html).toContain("Ricky Maynez, SVG MMA Academy");
    expect(mail.html).toContain(WAITLIST_WELCOME_REASON);
    expect(mail.html).toContain(WAITLIST_WELCOME_ADDRESS);
    expect(mail.html).toContain("Go train.");
    expect(mail.text).toContain("Go train.");
    expect(mail.text).toContain("Doors are open. You signed up early, so you're hearing it first. SVG Performance is live on the web now.");
    expect(mail.text).toContain(
      "The work is built for the fight, and for the week you actually have. Open it, set your days, and get after it.",
    );
    assertCopyRules(mail.html);
    assertCopyRules(mail.text);
  });

  it("uses SUPPORT_EMAIL for the reply-to and the visible support address", () => {
    env.SUPPORT_EMAIL = "corner@example.com";
    const mail = buildWaitlistLiveEmail("Ricky");
    expect(mail.replyTo).toBe("corner@example.com");
    expect(mail.html).toContain("mailto:corner@example.com");
    expect(mail.text).toContain("Questions? Write us at corner@example.com.");
  });

  it("logs and swallows a send failure without the secret", async () => {
    useSmtp();
    const secret = "re_test_live_secret";
    env.SMTP_PASS = secret;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    setMailSenderForTests(async () => {
      throw new Error(`auth failed for ${secret}`);
    });
    const result = await sendWaitlistLiveEmail({ to: "fighter@example.com", firstName: "Alex" });
    expect(result).toEqual({ sent: false, reason: "send_failed" });
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).toContain("waitlist live email failed");
    expect(logged).not.toContain(secret);
  });
});

describe("waitlist live send guard", () => {
  const sent: MailInput[] = [];

  beforeEach(async () => {
    await resetDatabase();
    resetWaitlistRateLimitForTests();
    restoreSmtp();
    useSmtp();
    delete env.ADMIN_EMAILS;
    delete env.MAILCHIMP_API_KEY;
    delete env.MAILCHIMP_SERVER_PREFIX;
    delete env.MAILCHIMP_AUDIENCE_ID;
    currentUser.mockReset();
    currentUser.mockResolvedValue(null);
    sent.length = 0;
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: true, reason: "sent" };
    });
    setWaitlistLiveTimingForTests({ gapMs: 0, batchSize: 10 });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreSmtp();
    setWaitlistLiveTimingForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seed(email: string, firstName: string, sentAt?: Date) {
    return prisma.waitlistSignup.create({
      data: {
        email,
        firstName,
        train: "MMA",
        member: "No",
        source: "waitlist",
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        ...(sentAt ? { liveEmailSentAt: sentAt } : {}),
      },
    });
  }

  it("rejects a signed-out caller and a non-admin, and the dry run sends nothing", async () => {
    await seed("pending@example.com", "Alex");

    const signedOut = await POST(liveRequest("/api/admin/waitlist/live", { method: "POST" }));
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toEqual({ error: "Sign in to continue." });

    const member = await makeUser("waitlist-live-member@example.com");
    currentUser.mockResolvedValue(member);
    const forbidden = await POST(
      liveRequest("/api/admin/waitlist/live?confirm=send", { method: "POST" }),
    );
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "Only an admin can do that." });
    await expect(runWaitlistLiveEmailAction({ confirm: "send" })).rejects.toMatchObject({ status: 403 });

    currentUser.mockResolvedValue(null);
    await expect(runWaitlistLiveEmailAction()).rejects.toMatchObject({ status: 401 });
    expect(sent).toHaveLength(0);
    expect(
      (await prisma.waitlistSignup.findUnique({ where: { email: "pending@example.com" } }))?.liveEmailSentAt,
    ).toBeNull();
  });

  it("dry-runs for an ADMIN_EMAILS admin and does not send, even if confirm is on GET", async () => {
    await seed("one@example.com", "Alex");
    await seed("two@example.com", "Sam");
    const reviewer = await makeUser("ricky-live@example.com");
    env.ADMIN_EMAILS = "Ricky-Live@example.com";
    currentUser.mockResolvedValue(reviewer);

    const dry = await POST(liveRequest("/api/admin/waitlist/live", { method: "POST" }));
    expect(dry.status).toBe(200);
    const body = await dry.json();
    expect(body).toMatchObject({
      ok: true,
      mode: "dry_run",
      recipientCount: 2,
      alreadySentCount: 0,
      batchSize: 10,
      gapMs: 0,
    });
    expect(body.preview.subject).toBe(WAITLIST_LIVE_SUBJECT);
    expect(body.preview.preheader).toBe(WAITLIST_LIVE_PREHEADER);
    expect(body.preview.html).toContain("Hey fighter,");
    expect(body.preview.text.startsWith("Hey fighter,")).toBe(true);
    expect(sent).toHaveLength(0);

    const peeked = await GET(liveRequest("/api/admin/waitlist/live?confirm=send"));
    expect(peeked.status).toBe(200);
    expect(await peeked.json()).toMatchObject({ mode: "dry_run", recipientCount: 2 });
    expect(sent).toHaveLength(0);

    const action = await runWaitlistLiveEmailAction({ firstName: "Ricky" });
    expect(action).toMatchObject({ ok: true, mode: "dry_run", recipientCount: 2 });
    if (action.ok && action.mode === "dry_run") {
      expect(action.preview.html).toContain("Hey Ricky,");
    }
    expect(sent).toHaveLength(0);
  });

  it("sends only unstamped rows when confirm is send, then skips them", async () => {
    const alreadyAt = new Date("2026-11-16T15:00:00.000Z");
    await prisma.waitlistSignup.create({
      data: {
        email: "already@example.com",
        firstName: "Sam",
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        liveEmailSentAt: alreadyAt,
      },
    });
    await prisma.waitlistSignup.create({
      data: {
        email: "next@example.com",
        firstName: "Alex",
        createdAt: new Date("2026-11-02T00:00:00.000Z"),
      },
    });
    const admin = await makeUser("waitlist-live-admin@example.com", false, "admin");
    currentUser.mockResolvedValue(admin);

    const response = await POST(
      liveRequest("/api/admin/waitlist/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "send", to: "not-the-list@example.com" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mode: "send", sent: 1, failed: 0, skipped: 0, remaining: 0 });
    expect(sent.map((mail) => mail.to)).toEqual(["next@example.com"]);
    expect(sent[0]?.subject).toBe(WAITLIST_LIVE_SUBJECT);
    expect(sent[0]?.replyTo).toBe("support@svgperformance.app");
    expect(sent[0]?.html).toContain("Hey Alex,");
    expect(sent[0]?.text).toContain("Hey Alex,");

    const already = await prisma.waitlistSignup.findUnique({ where: { email: "already@example.com" } });
    expect(already?.liveEmailSentAt?.toISOString()).toBe(alreadyAt.toISOString());
    const next = await prisma.waitlistSignup.findUnique({ where: { email: "next@example.com" } });
    expect(next?.liveEmailSentAt).toBeTruthy();

    const again = await runWaitlistLiveEmail({ confirm: "send" });
    expect(again).toMatchObject({ ok: true, mode: "send", sent: 0, remaining: 0 });
    expect(sent).toHaveLength(1);
  });

  it("rate-limits a batch and leaves the rest for the next confirm", async () => {
    const gaps: number[] = [];
    setWaitlistLiveTimingForTests({
      batchSize: 2,
      gapMs: 40,
      sleep: async (ms) => {
        gaps.push(ms);
      },
    });
    await prisma.waitlistSignup.createMany({
      data: [
        { email: "a@example.com", firstName: "A", createdAt: new Date("2026-11-01T00:00:00.000Z") },
        { email: "b@example.com", firstName: "B", createdAt: new Date("2026-11-01T00:01:00.000Z") },
        { email: "c@example.com", firstName: "", createdAt: new Date("2026-11-01T00:02:00.000Z") },
      ],
    });
    const admin = await makeUser("batch-admin@example.com", false, "admin");
    currentUser.mockResolvedValue(admin);

    const first = await POST(
      liveRequest("/api/admin/waitlist/live?confirm=send", { method: "POST" }),
    );
    expect(await first.json()).toMatchObject({ mode: "send", sent: 2, remaining: 1 });
    expect(sent.map((mail) => mail.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(gaps).toEqual([40]);

    const second = await runWaitlistLiveEmailAction({ confirm: "send" });
    expect(second).toMatchObject({ ok: true, mode: "send", sent: 1, remaining: 0 });
    expect(sent[2]?.html).toContain("Hey fighter,");
    expect(gaps).toEqual([40]);
  });

  it("does not stamp a failed send, and stops when mail is not configured", async () => {
    await seed("fail@example.com", "Alex");
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: false, reason: "send_failed" };
    });
    const admin = await makeUser("fail-admin@example.com", false, "admin");
    currentUser.mockResolvedValue(admin);
    const failed = await runWaitlistLiveEmail({ confirm: "send" });
    expect(failed).toMatchObject({ mode: "send", sent: 0, failed: 1, remaining: 1 });
    expect(
      (await prisma.waitlistSignup.findUnique({ where: { email: "fail@example.com" } }))?.liveEmailSentAt,
    ).toBeNull();

    delete env.SMTP_HOST;
    await prisma.waitlistSignup.create({
      data: { email: "later@example.com", firstName: "Later", createdAt: new Date("2026-11-03T00:00:00.000Z") },
    });
    sent.length = 0;
    const stopped = await runWaitlistLiveEmail({ confirm: "send" });
    expect(stopped).toMatchObject({ mode: "send", sent: 0, failed: 1, remaining: 2, reason: "not_configured" });
    expect(sent).toHaveLength(0);
  });

  it("test-sends one address and does not stamp the list", async () => {
    await seed("list@example.com", "Alex");
    const admin = await makeUser("test-send-admin@example.com", false, "admin");
    currentUser.mockResolvedValue(admin);

    const missing = await POST(
      liveRequest("/api/admin/waitlist/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "test" }),
      }),
    );
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ ok: false, error: WAITLIST_EMAIL_ERROR });
    expect(sent).toHaveLength(0);

    const member = await makeUser("test-send-member@example.com");
    currentUser.mockResolvedValue(member);
    const blocked = await POST(
      liveRequest("/api/admin/waitlist/live?confirm=test&to=coach@example.com", { method: "POST" }),
    );
    expect(blocked.status).toBe(403);
    expect(sent).toHaveLength(0);

    currentUser.mockResolvedValue(admin);
    const ok = await POST(
      liveRequest("/api/admin/waitlist/live?confirm=test&to=Coach@Example.com&firstName=Ricky", {
        method: "POST",
      }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, mode: "test", to: "coach@example.com", sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("coach@example.com");
    expect(sent[0]?.html).toContain("Hey Ricky,");
    expect(
      (await prisma.waitlistSignup.findUnique({ where: { email: "list@example.com" } }))?.liveEmailSentAt,
    ).toBeNull();
  });

  it("renders the preview for an admin and refuses everyone else", async () => {
    expect((await previewLive(liveRequest("/api/admin/waitlist/live/preview?firstName=Ricky"))).status).toBe(401);
    const member = await makeUser("preview-member@example.com");
    currentUser.mockResolvedValue(member);
    expect((await previewLive(liveRequest("/api/admin/waitlist/live/preview"))).status).toBe(403);

    env.ADMIN_EMAILS = "preview-admin@example.com";
    const reviewer = await makeUser("preview-admin@example.com");
    currentUser.mockResolvedValue(reviewer);
    const response = await previewLive(
      liveRequest("/api/admin/waitlist/live/preview?firstName=Ricky"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("We're live.<br />Get to work.");
    expect(html).toContain("Hey Ricky,");
    expect(sent).toHaveLength(0);
  });

  it("does not send from signup, and the column migration stays additive", async () => {
    const created = await joinWaitlist(
      new Request("https://svgperformance.app/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.80" },
        body: JSON.stringify({ firstName: "Alex", email: "joined@example.com", train: "MMA", member: "No" }),
      }),
    );
    expect(created.status).toBe(200);
    expect(sent.map((mail) => mail.subject)).toEqual([WAITLIST_WELCOME_SUBJECT]);
    expect(
      (await prisma.waitlistSignup.findUnique({ where: { email: "joined@example.com" } }))?.liveEmailSentAt,
    ).toBeNull();

    const signup = readFileSync("src/lib/launch-waitlist.ts", "utf8");
    expect(signup).not.toContain("sendWaitlistLiveEmail");
    expect(signup).not.toContain("waitlist-live");
    const route = readFileSync("src/app/api/waitlist/route.ts", "utf8");
    expect(route).not.toContain("sendWaitlistLiveEmail");
    expect(readFileSync("vercel.json", "utf8")).not.toContain("waitlist/live");

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = `${dir}/${name}`;
        if (statSync(full).isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk("src/app/api/cron");
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toContain("waitlist-live");
      expect(text).not.toContain("sendWaitlistLiveEmail");
    }

    const migration = readFileSync(
      "prisma/migrations/20261116210000_waitlist_live_email_sent_at/migration.sql",
      "utf8",
    );
    expect(migration.toUpperCase()).not.toMatch(/\bDROP\b/);
    expect(migration).toContain('ADD COLUMN "live_email_sent_at" DATETIME');
    const hosted = readFileSync("prisma/hosted-additive.sql", "utf8");
    expect(hosted).toMatch(
      /IF NOT EXISTS \([\s\S]*live_email_sent_at[\s\S]*ADD COLUMN "live_email_sent_at" TIMESTAMP\(3\)/,
    );
    expect(hosted.toUpperCase()).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/);
    expect(readFileSync("scripts/prisma-prepare.mjs", "utf8")).not.toContain("--accept-data-loss");
    expect(readFileSync("src/app/(member)/admin/waitlist/page.tsx", "utf8")).toContain(
      'href="/api/admin/waitlist/live/preview"',
    );
    expect(readFileSync("src/app/(member)/admin/waitlist/page.tsx", "utf8")).not.toContain("confirm=send");
    expect(WAITLIST_LIVE_BATCH_SIZE).toBe(10);
    expect(WAITLIST_LIVE_GAP_MS).toBe(250);
  });
});
