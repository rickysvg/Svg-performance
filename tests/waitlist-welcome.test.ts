import { afterEach, describe, expect, it } from "vitest";
import { setMailSenderForTests } from "@/lib/mail";
import { SUPPORT_EMAIL_FALLBACK } from "@/lib/support";
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

