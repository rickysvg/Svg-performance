/** Copy and checks shared by the public page and POST /api/waitlist. No secrets. */

export const WAITLIST_NAME_ERROR = "Need a name for your corner.";
export const WAITLIST_EMAIL_ERROR = "That email doesn't look right. Check it and go again.";
export const WAITLIST_ALREADY_MESSAGE = "You're already on the list. Stay ready.";
export const WAITLIST_RATE_MESSAGE = "Too many tries. Wait a minute and go again.";
export const WAITLIST_GENERIC_ERROR = "Something went wrong. Go again.";

export const WAITLIST_EYEBROW = "BUILT AT SVG MMA ACADEMY · LAUNCHING NOV 16";
export const WAITLIST_HEADLINE_LEAD = "Be ";
export const WAITLIST_HEADLINE_FIRST = "first";
export const WAITLIST_HEADLINE_MID = " in. It drops ";
export const WAITLIST_HEADLINE_DATE = "Nov 16";
export const WAITLIST_HEADLINE_END = ".";

export const WAITLIST_SUBHEADLINE_BEFORE =
  "Fighter-first training built around your class and sparring days: RIR-based S&C, themed bag rounds and five AI coaches in your corner. Get on the list and you're the first to know when it drops on ";
export const WAITLIST_SUBHEADLINE_DATE = "Monday, Nov 16";
export const WAITLIST_SUBHEADLINE_AFTER = ".";

export const WAITLIST_SUBHEADLINE =
  WAITLIST_SUBHEADLINE_BEFORE + WAITLIST_SUBHEADLINE_DATE + WAITLIST_SUBHEADLINE_AFTER;

export const WAITLIST_BUTTON = "JOIN THE WAITLIST";
export const WAITLIST_ACADEMY_NOTE =
  "Train at SVG MMA Academy? Your app account links to your membership automatically through Gymdesk.";
export const WAITLIST_PRIVACY_BEFORE =
  "We only use your email for SVG Performance launch and training updates. No spam. Unsubscribe anytime.";
export const WAITLIST_PRIVACY_LABEL = "Privacy";

export const WAITLIST_MEMBER_QUESTION = "Do you train at SVG MMA Academy?";
export const WAITLIST_TRAIN_LABEL = "What do you train?";

export const WAITLIST_CONFIRM_HEADLINE_BEFORE = "You're in, ";
export const WAITLIST_CONFIRM_HEADLINE_AFTER = ". Stay ready.";
export const WAITLIST_CONFIRM_BEFORE = "You\u2019re on the list. When SVG Performance drops on ";
export const WAITLIST_CONFIRM_DATE = "Monday, Nov 16";
export const WAITLIST_CONFIRM_AFTER =
  ", you\u2019ll be first to know. Check your inbox for Ricky\u2019s welcome.";

export const WAITLIST_START_TRAINING = "START TRAINING TODAY";
export const WAITLIST_WEB_LINE = "Train on the web. Open it on your phone, no download needed.";
export const WAITLIST_APPS_LINE = "iPhone and Android apps are on the way.";
export const WAITLIST_SHARE_LINE = "Know someone grinding without a plan? Send them this page.";

export const WAITLIST_LAUNCH_DAY = "2026-11-16";
export const WAITLIST_HONEYPOT_FIELD = "svg_hp";
export const WAITLIST_SOURCE = "waitlist";
export const WAITLIST_TAG = "waitlist";

export const WAITLIST_DISCIPLINES = [
  "MMA",
  "Boxing",
  "Muay Thai",
  "BJJ",
  "Wrestling",
  "Other",
] as const;

export type WaitlistDiscipline = (typeof WAITLIST_DISCIPLINES)[number];
export type WaitlistMember = "Yes" | "No";

export type WaitlistInput = {
  firstName: string;
  email: string;
  train: WaitlistDiscipline | "";
  member: WaitlistMember;
};

export const WAITLIST_FAQ: { question: string; answer: string }[] = [
  {
    question: "What do I get for joining the waitlist?",
    answer:
      "You're first to know when we drop on Monday, Nov 16, plus a sneak peek at what's inside and training tips from Ricky.",
  },
  {
    question: "What happens after I join?",
    answer: "Watch your inbox for launch updates and training tips from Ricky.",
  },
  {
    question: "What's in the app?",
    answer:
      "The full program (rounds, blocks, Calendar, sparring log, check-ins, Fuel logging) plus AI coach chat with five coaching styles (text-only), RIR that auto-adjusts after sparring or low readiness, AI feedback on check-ins and meals, sparring trends and full history.",
  },
  {
    question: "I train at SVG MMA Academy. Do I need this?",
    answer: WAITLIST_ACADEMY_NOTE,
  },
  {
    question: "Do I have to train at SVG?",
    answer: "No. It's for fighters anywhere, 18+.",
  },
  {
    question: "How does it fit my schedule?",
    answer:
      "Set your training and sparring days, then move sessions on the Calendar when your week changes.",
  },
  {
    question: "Who are the AI coaches?",
    answer:
      "Skye, Maya, Mateo, Cole and Coach Ricky, each with its own coaching style. Coach Ricky is an AI modeled on Ricky's coaching style. For the real Ricky, look for Book with Ricky (1-on-1 coaching with Ricky) in the app.",
  },
];

/** New York calendar day, so launch morning matches the academy. */
export function isWaitlistLive(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return day >= WAITLIST_LAUNCH_DAY;
}

export function waitlistConfirmHeadline(firstName: string) {
  return `${WAITLIST_CONFIRM_HEADLINE_BEFORE}${firstName}${WAITLIST_CONFIRM_HEADLINE_AFTER}`;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!name || name.length > 80) return null;
  if (/[\u0000-\u001f<>]/.test(name)) return null;
  if (!/\p{L}/u.test(name)) return null;
  return name;
}

function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (email.includes("..")) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function cleanTrain(raw: unknown): WaitlistDiscipline | "" | null {
  if (raw == null || raw === "") return "";
  if (typeof raw !== "string") return null;
  const train = raw.trim();
  if (!train) return "";
  return (WAITLIST_DISCIPLINES as readonly string[]).includes(train)
    ? (train as WaitlistDiscipline)
    : null;
}

function cleanMember(raw: unknown): WaitlistMember | null {
  if (raw == null || raw === "") return "No";
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return null;
}

export function honeypotFilled(body: unknown) {
  const record = asRecord(body);
  return String(record[WAITLIST_HONEYPOT_FIELD] ?? "").trim() !== "";
}

export function parseWaitlistBody(
  body: unknown,
): { ok: true; value: WaitlistInput } | { ok: false; error: string } {
  const record = asRecord(body);
  const firstName = cleanName(record.firstName);
  if (!firstName) return { ok: false, error: WAITLIST_NAME_ERROR };
  const email = cleanEmail(record.email);
  if (!email) return { ok: false, error: WAITLIST_EMAIL_ERROR };
  const train = cleanTrain(record.train);
  if (train === null) return { ok: false, error: "Pick a discipline from the list, or leave it blank." };
  const member = cleanMember(record.member);
  if (!member) return { ok: false, error: "Choose Yes or No." };
  return { ok: true, value: { firstName, email, train, member } };
}
