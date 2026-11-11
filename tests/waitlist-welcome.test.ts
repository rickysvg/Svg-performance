import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers";
import { POST } from "@/app/api/waitlist/route";
import { resetWaitlistRateLimitForTests, WAITLIST_RATE_LIMIT } from "@/lib/launch-waitlist";
import { setMailSenderForTests, type MailInput } from "@/lib/mail";
import { SUPPORT_EMAIL_FALLBACK } from "@/lib/support";
import { WAITLIST_ALREADY_MESSAGE, WAITLIST_HONEYPOT_FIELD } from "@/lib/waitlist-shared";
import {
  buildWaitlistWelcomeEmail,
  WAITLIST_WELCOME_ADDRESS,
  WAITLIST_WELCOME_APP_URL,
  WAITLIST_WELCOME_PREHEADER,
  WAITLIST_WELCOME_REASON,
  WAITLIST_WELCOME_SUBJECT,
} from "@/lib/waitlist-welcome";

const env = process.env as Record<string, string | undefined>;
const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SUPPORT_EMAIL"] as const;
const smtpSnapshot = Object.fromEntries(smtpKeys.map((key) => [key, env[key]])) as Record<
  (typeof smtpKeys)[number],
  string | undefined
>;

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

const EXPECTATION_TITLES = [
  "Strength that serves the fight",
  "Bag rounds and shadowboxing",
  "Mobility",
  "Logger with RIR",
  "Short form videos",
  "Progress tracking",
  "Plans tuned to your level",
];

function assertCopyRules(value: string) {
  expect(value).not.toMatch(/\$\s?\d/);
  expect(value.toLowerCase()).not.toContain("nov 16");
  expect(value.toLowerCase()).not.toContain("november 16");
  expect(value.toLowerCase()).not.toMatch(/\b(app store|google play|play store)\b/);
  expect(value.toLowerCase().match(/download/g)).toEqual(["download"]);
  expect(value).toContain("Train on the web. Open it on your phone, no download needed.");
  expect(value).toContain("iPhone and Android apps are on the way.");
  expect(value).not.toContain("*|");
}

describe("waitlist welcome template", () => {
  afterEach(() => {
    restoreSmtp();
  });

  it("uses the signup name, and falls back when it is empty", () => {
    const named = buildWaitlistWelcomeEmail("  Ricky  ");
    expect(named.subject).toBe(WAITLIST_WELCOME_SUBJECT);
    expect(named.subject).toBe("You're in. Stay ready.");
    expect(named.preheader).toBe(WAITLIST_WELCOME_PREHEADER);
    expect(named.text.startsWith("Hey Ricky,")).toBe(true);
    expect(named.html).toContain("Hey Ricky,");
    expect(named.html).not.toContain("Hey fighter,");

    for (const blank of ["", "   ", "\n\t"]) {
      const mail = buildWaitlistWelcomeEmail(blank);
      expect(mail.text.startsWith("Hey fighter,")).toBe(true);
      expect(mail.html).toContain("Hey fighter,");
      expect(mail.html).not.toContain("Hey ,");
    }
  });

  it("escapes the first name in html and keeps it literal in plain text", () => {
    const name = `Sam <script>alert("x")</script> & Co`;
    const mail = buildWaitlistWelcomeEmail(name);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Hey Sam &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co,");
    expect(mail.text).toContain(`Hey ${name},`);
    expect(mail.text).not.toContain("&lt;");
  });

  it("renders the branded welcome with no unresolved merge tags", () => {
    const mail = buildWaitlistWelcomeEmail("Ricky");
    expect(mail.replyTo).toBe(SUPPORT_EMAIL_FALLBACK);
    expect(mail.replyTo).toBe("support@svgperformance.app");
    expect(mail.html).toContain(WAITLIST_WELCOME_PREHEADER);
    expect(mail.html).toContain("background-color:#07080a");
    expect(mail.html).toContain("background-color:#000000");
    expect(mail.html).toContain("#CBF805");
    expect(mail.html).toContain("Anton, Impact");
    expect(mail.html).toContain("fonts.googleapis.com/css2?family=Anton");
    expect(mail.html).toContain('src="https://svgperformance.app/svg-performance-badge-mark.png"');
    expect(mail.html).toContain("You're in.<br />Stay ready.");
    expect(mail.html).toContain("Built at SVG MMA Academy");
    expect(mail.html).toContain("Here's what you can expect");
    for (const title of EXPECTATION_TITLES) {
      expect(mail.html).toContain(title);
      expect(mail.text).toContain(title);
    }
    expect(mail.html).toContain(">See the app<");
    expect(mail.html).toContain(`href="${WAITLIST_WELCOME_APP_URL}"`);
    expect(mail.text).toContain(WAITLIST_WELCOME_APP_URL);
    expect(mail.html).toContain("Coach Ricky");
    expect(mail.html).toContain("Ricky Maynez, SVG MMA Academy");
    expect(mail.html).toContain(WAITLIST_WELCOME_REASON);
    expect(mail.html).toContain(WAITLIST_WELCOME_ADDRESS);
    expect(mail.html).toContain("support@svgperformance.app");
    expect(mail.html).toContain('href="https://svgperformance.app/privacy"');
    expect(mail.text).toContain(WAITLIST_WELCOME_REASON);
    expect(mail.text).toContain(WAITLIST_WELCOME_ADDRESS);
    expect(mail.text).toContain("Go train.");
    assertCopyRules(mail.html);
    assertCopyRules(mail.text);
  });

  it("uses SUPPORT_EMAIL for the reply-to and the visible support address", () => {
    env.SUPPORT_EMAIL = "corner@example.com";
    const mail = buildWaitlistWelcomeEmail("Ricky");
    expect(mail.replyTo).toBe("corner@example.com");
    expect(mail.html).toContain("mailto:corner@example.com");
    expect(mail.html).toContain(">corner@example.com<");
    expect(mail.text).toContain("Questions? Write us at corner@example.com.");
    expect(mail.html).not.toContain("*|");
  });
});

describe("waitlist welcome send", () => {
  beforeEach(async () => {
    await resetDatabase();
    resetWaitlistRateLimitForTests();
    restoreSmtp();
    delete env.MAILCHIMP_API_KEY;
    delete env.MAILCHIMP_SERVER_PREFIX;
    delete env.MAILCHIMP_AUDIENCE_ID;
    delete env.MAILCHIMP_DOUBLE_OPTIN;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreSmtp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sends only when the signup is new", async () => {
    useSmtp();
    const sent: MailInput[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: true, reason: "sent" };
    });

    const created = await post(person("fighter@example.com"), "203.0.113.40");
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({ ok: true, status: "subscribed", firstName: "Alex" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "fighter@example.com",
      subject: WAITLIST_WELCOME_SUBJECT,
      replyTo: "support@svgperformance.app",
    });
    expect(sent[0]?.html).toContain("Hey Alex,");
    expect(sent[0]?.text).toContain("Hey Alex,");
    expect(sent[0]?.html).not.toContain("*|");
    expect(sent[0]?.text).not.toContain("*|");

    const again = await post(person("Fighter@Example.com", { firstName: "Alexis" }), "203.0.113.41");
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ ok: false, error: WAITLIST_ALREADY_MESSAGE });
    expect(sent).toHaveLength(1);

    const honeypot = await post(
      person("bot@example.com", { [WAITLIST_HONEYPOT_FIELD]: "https://spam.example" }),
      "203.0.113.42",
    );
    expect(honeypot.status).toBe(200);
    expect(await prisma.waitlistSignup.count()).toBe(1);
    expect(sent).toHaveLength(1);

    const bad = await post({ firstName: "Alex", email: "not-an-email" }, "203.0.113.43");
    expect(bad.status).toBe(400);
    expect(sent).toHaveLength(1);
  });

  it("does not send when Mailchimp already has the address", async () => {
    useSmtp();
    env.MAILCHIMP_API_KEY = "test-key-not-real";
    env.MAILCHIMP_SERVER_PREFIX = "us21";
    env.MAILCHIMP_AUDIENCE_ID = "abc123def4";
    const sent: MailInput[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: true, reason: "sent" };
    });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ status: "subscribed" }), { status: 200 }));

    const response = await post(person("exists@example.com"), "203.0.113.44");
    expect(response.status).toBe(409);
    expect(sent).toHaveLength(0);
    expect(await prisma.waitlistSignup.findUnique({ where: { email: "exists@example.com" } })).toBeTruthy();
  });

  it("does not send the request that rate limit rejects", async () => {
    useSmtp();
    const sent: string[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input.to);
      return { sent: true, reason: "sent" };
    });

    for (let i = 0; i < WAITLIST_RATE_LIMIT; i += 1) {
      const response = await post(person(`rate-${i}@example.com`), "203.0.113.45");
      expect(response.status).toBe(200);
    }
    expect(sent).toHaveLength(WAITLIST_RATE_LIMIT);

    const blocked = await post(person("rate-over@example.com"), "203.0.113.45");
    expect(blocked.status).toBe(429);
    expect(sent).toHaveLength(WAITLIST_RATE_LIMIT);
    expect(await prisma.waitlistSignup.findUnique({ where: { email: "rate-over@example.com" } })).toBeNull();
  });

  it("still confirms when the welcome email throws, and logs no secrets", async () => {
    useSmtp();
    const secret = "re_test_welcome_secret";
    env.SMTP_PASS = secret;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    setMailSenderForTests(async () => {
      throw new Error(`auth failed for ${secret}`);
    });

    const response = await post(person("still-in@example.com"), "203.0.113.46");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "subscribed" });
    expect(await prisma.waitlistSignup.findUnique({ where: { email: "still-in@example.com" } })).toBeTruthy();
    expect(errorLog).toHaveBeenCalled();
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).toContain("waitlist welcome email failed");
  });

  it("confirms a new signup when mail is not configured and does not call the sender", async () => {
    delete env.SMTP_HOST;
    const sent: MailInput[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: true, reason: "sent" };
    });

    const response = await post(person("offline@example.com"), "203.0.113.47");
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(0);
    expect(await prisma.waitlistSignup.count()).toBe(1);
  });
});
