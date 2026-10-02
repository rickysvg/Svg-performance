import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { REMINDER_LOGO_URL, reminderEmailHtml } from "@/lib/mail";
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
  // Next's ProcessEnv marks NODE_ENV readonly. Mutate through a string map,
  // the same way the other env-dependent tests stay valid under `next build`.
  const env = process.env as Record<string, string | undefined>;
  const snapshot = { NODE_ENV: env.NODE_ENV, APP_URL: env.APP_URL };

  afterEach(() => {
    env.NODE_ENV = snapshot.NODE_ENV;
    if (snapshot.APP_URL === undefined) delete env.APP_URL;
    else env.APP_URL = snapshot.APP_URL;
  });

  it("tailors a single workout reminder and deep-links to Train", () => {
    const mail = buildReminderEmail([WORKOUT], ORIGIN);
    expect(mail.subject).toBe("Your session is waiting");
    expect(mail.text).toContain("CONQUER THE DAY");
    expect(mail.text).toContain("SESSION IS WAITING");
    expect(mail.text).toContain("The session you picked is ready when you are.");
    expect(mail.text).toContain("A quick look keeps the day moving.");
    expect(mail.text).not.toContain("It has not been logged");
    expect(mail.text).toContain("Automated reminder from SVG Performance.");
    expect(mail.text).toContain("A coach is not texting you.");
    expect(mail.text).toContain(WORKOUT.message);
    expect(mail.text).toContain("Open Train:");
    expect(mail.text).toContain(`${ORIGIN}/training`);
    expect(mail.text).toContain("Turn these off any time under Profile → Reminders.");
    expect(mail.text).toContain(`${ORIGIN}/profile`);
    expect(mail.text).not.toMatch(/gentle/i);
    expect(mail.html).toContain("Conquer the day");
    expect(mail.html).toContain("Session is waiting");
    expect(mail.html).toContain(`src="${REMINDER_LOGO_URL}"`);
    expect(REMINDER_LOGO_URL).toBe(
      "https://svg-performance.vercel.app/svg-performance-badge-mark.png",
    );
    expect(mail.html).toContain('alt="SVG Performance"');
    expect(mail.html).not.toMatch(/src="\/svg-performance/);
    expect(mail.html).not.toContain(".webp");
    expect(fs.statSync("public/svg-performance-badge-mark.png").size).toBeGreaterThan(20_000);
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
    expect(food.subject).toBe("Fuel is waiting");
    expect(food.text).toContain("FUEL IS WAITING");
    expect(food.text).toContain("Close enough is fine.");
    expect(food.text).toContain("Open Fuel.");
    expect(food.text).not.toContain("still empty");
    expect(food.html).toContain(">Open Fuel<");
    expect(food.html).toContain(`${ORIGIN}/nutrition`);

    const quote = buildReminderEmail([QUOTE], ORIGIN);
    expect(quote.subject).toBe("Today's line is in");
    expect(quote.text).toContain("THE LINE IS IN");
    expect(quote.text).toContain("at your pace");
    expect(quote.text).toContain("Open Home.");
    expect(quote.html).toContain(">Open Home<");
    expect(quote.html).toContain(`${ORIGIN}/home`);
    expect(quote.text).toContain(QUOTE.message);

    const booking = buildReminderEmail([BOOKING], ORIGIN);
    expect(booking.subject).toBe("Book with Ricky");
    expect(booking.text).toContain("YOUR REQUEST IS HERE");
    expect(booking.text).toContain("if you want to check it");
    expect(booking.html).toContain(">Open Book<");
    expect(booking.html).toContain(`${ORIGIN}/book`);
    expect(booking.text).toContain("not a confirmed slot");
  });

  it("uses one today's callouts block when more than one kind is due", () => {
    const mail = buildReminderEmail([WORKOUT, FOOD, QUOTE], ORIGIN);
    expect(mail.subject).toBe("A few things are waiting");
    expect(mail.text).toContain("A FEW THINGS ARE WAITING");
    expect(mail.text).toContain("easy to handle when you open the app");
    expect(mail.text).not.toContain("Clear it");
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
    env.NODE_ENV = "production";
    env.APP_URL = "http://localhost:3000";
    expect(performanceAppOrigin()).toBe(PERFORMANCE_APP_ORIGIN);
    delete env.APP_URL;
    expect(performanceAppOrigin()).toBe(PERFORMANCE_APP_ORIGIN);
    env.APP_URL = "https://preview.example.com/app";
    expect(performanceAppOrigin()).toBe("https://preview.example.com");
    const mail = buildReminderEmail([WORKOUT]);
    expect(mail.html).toContain("https://preview.example.com/training");
    expect(mail.html).toContain(REMINDER_LOGO_URL);
  });

  it("keeps the lime CTA and black card when the template is called directly", () => {
    const html = reminderEmailHtml({
      eyebrow: "Conquer the day",
      headline: "Session is waiting",
      intro: "Automated reminder from SVG Performance. A coach is not texting you.",
      items: [{ label: "Workout", message: "Log it." }],
      ctaLabel: "Open Train",
      ctaHref: `${ORIGIN}/training`,
      pull: "Open Train. Your session and your streak are waiting there. A quick look keeps the day moving.",
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
