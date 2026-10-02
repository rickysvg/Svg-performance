import { afterEach, describe, expect, it } from "vitest";
import { reminderEmailHtml } from "@/lib/mail";
import {
  buildReminderEmail,
  PERFORMANCE_APP_ORIGIN,
  performanceAppOrigin,
  type DueReminder,
} from "@/lib/reminders";

const ORIGIN = "https://svg-performance.vercel.app";

const WORKOUT: DueReminder = {
  kind: "workout",
  message: "Reminder: log a session if you trained today. Easy to skip if you already did.",
};
const FOOD: DueReminder = {
  kind: "food",
  message: "Reminder: add a food estimate when you have a minute. Estimates are fine.",
};
const QUOTE: DueReminder = {
  kind: "quote",
  message: 'Today’s quote: “Precision beats power, and timing beats speed.”',
};
const BOOKING: DueReminder = {
  kind: "booking",
  message:
    "Reminder: you have an open Book with Ricky request. Preferred times are on file. This is not a confirmed slot.",
};

describe("reminder email", () => {
  const env = { NODE_ENV: process.env.NODE_ENV, APP_URL: process.env.APP_URL };

  afterEach(() => {
    process.env.NODE_ENV = env.NODE_ENV;
    if (env.APP_URL === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = env.APP_URL;
  });

  it("tailors a single workout reminder and deep-links to Train", () => {
    const mail = buildReminderEmail([WORKOUT], ORIGIN);
    expect(mail.subject).toBe("Own the session");
    expect(mail.text).toContain("CONQUER THE DAY");
    expect(mail.text).toContain("OWN THE SESSION");
    expect(mail.text).toContain("Automated reminder from SVG Performance.");
    expect(mail.text).toContain("A coach is not texting you.");
    expect(mail.text).toContain(WORKOUT.message);
    expect(mail.text).toContain("Open Train:");
    expect(mail.text).toContain(`${ORIGIN}/training`);
    expect(mail.text).toContain("Turn these off any time under Profile → Reminders.");
    expect(mail.text).toContain(`${ORIGIN}/profile`);
    expect(mail.text).not.toMatch(/gentle/i);
    expect(mail.html).toContain("Conquer the day");
    expect(mail.html).toContain("Own the session");
    expect(mail.html).toContain("#CBF805");
    expect(mail.html).toContain("background-color:#000000");
    expect(mail.html).toContain("Impact,'Arial Black',Helvetica,Arial,sans-serif");
    expect(mail.html).toContain(">Open Train<");
    expect(mail.html).toContain(`${ORIGIN}/training`);
    expect(mail.html).toContain(`${ORIGIN}/profile`);
    expect(mail.html).toContain("Profile → Reminders");
    expect(mail.html).not.toMatch(/gentle/i);
    expect(mail.html).not.toContain("fonts.googleapis");
  });

  it("deep-links fuel, quote, and booking reminders", () => {
    const food = buildReminderEmail([FOOD], ORIGIN);
    expect(food.subject).toBe("Fuel the work");
    expect(food.text).toContain("FUEL THE WORK");
    expect(food.html).toContain(">Open Fuel<");
    expect(food.html).toContain(`${ORIGIN}/nutrition`);

    const quote = buildReminderEmail([QUOTE], ORIGIN);
    expect(quote.subject).toBe("Today's line");
    expect(quote.text).toContain("CARRY THIS LINE");
    expect(quote.html).toContain(">Open Home<");
    expect(quote.html).toContain(`${ORIGIN}/home`);
    expect(quote.text).toContain(QUOTE.message);

    const booking = buildReminderEmail([BOOKING], ORIGIN);
    expect(booking.subject).toBe("Book with Ricky");
    expect(booking.html).toContain(">Open Book<");
    expect(booking.html).toContain(`${ORIGIN}/book`);
    expect(booking.text).toContain("not a confirmed slot");
  });

  it("uses one today's callouts block when more than one kind is due", () => {
    const mail = buildReminderEmail([WORKOUT, FOOD, QUOTE], ORIGIN);
    expect(mail.subject).toBe("Today's callouts");
    expect(mail.text).toContain("TODAY'S CALLOUTS");
    expect(mail.text).toContain("Conquer the day. Everything still open is below.");
    expect(mail.text).toContain("WORKOUT");
    expect(mail.text).toContain("FUEL");
    expect(mail.text).toContain("QUOTE");
    expect(mail.html).toContain(">Open Home<");
    expect(mail.html).toContain(`${ORIGIN}/home`);
    expect(mail.html).not.toContain(`${ORIGIN}/training`);
  });

  it("escapes reminder text in html and keeps it literal in plain text", () => {
    const message = `Today’s quote: “<script>alert("x")</script> & co”`;
    const mail = buildReminderEmail([{ kind: "quote", message }], ORIGIN);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&amp; co");
    expect(mail.html).toContain("&quot;x&quot;");
    expect(mail.text).toContain(message);
  });

  it("falls back to the public app when APP_URL is missing or not safe in production", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3000";
    expect(performanceAppOrigin()).toBe(PERFORMANCE_APP_ORIGIN);
    delete process.env.APP_URL;
    expect(performanceAppOrigin()).toBe(PERFORMANCE_APP_ORIGIN);
    process.env.APP_URL = "https://preview.example.com/app";
    expect(performanceAppOrigin()).toBe("https://preview.example.com");
    const mail = buildReminderEmail([WORKOUT]);
    expect(mail.html).toContain("https://preview.example.com/training");
  });

  it("keeps the lime CTA and black card when the template is called directly", () => {
    const html = reminderEmailHtml({
      eyebrow: "Conquer the day",
      brand: "SVG Performance",
      headline: "Own the session",
      intro: "Automated reminder from SVG Performance. A coach is not texting you.",
      items: [{ label: "Workout", message: "Log it." }],
      ctaLabel: "Open Train",
      ctaHref: `${ORIGIN}/training`,
      profileHref: `${ORIGIN}/profile`,
      footer: "Turn these off any time under Profile → Reminders.",
      preheader: "Automated SVG Performance reminder. Own the session.",
    });
    expect(html).toContain("bgcolor=\"#000000\"");
    expect(html).toContain("bgcolor=\"#CBF805\"");
    expect(html).toContain("color:#111111");
    expect(html).toContain(">Open Train<");
  });
});
