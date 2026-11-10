import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError, isUniqueConstraintError } from "@/lib/errors";
import {
  honeypotFilled,
  parseWaitlistBody,
  WAITLIST_RATE_MESSAGE,
  WAITLIST_SOURCE,
  WAITLIST_TAG,
  type WaitlistInput,
  type WaitlistMember,
} from "@/lib/waitlist-shared";

export const WAITLIST_RATE_LIMIT = 8;
export const WAITLIST_RATE_WINDOW_MS = 10 * 60 * 1000;

type Bucket = { resetAt: number; count: number };
const buckets = new Map<string, Bucket>();

export function resetWaitlistRateLimitForTests() {
  buckets.clear();
}

export function assertWaitlistRateLimit(ip: string, now = Date.now()) {
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  const key = ip.slice(0, 80) || "unknown";
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { resetAt: now + WAITLIST_RATE_WINDOW_MS, count: 1 });
    return;
  }
  if (current.count >= WAITLIST_RATE_LIMIT) {
    throw new AppError("RATE", WAITLIST_RATE_MESSAGE, 429);
  }
  current.count += 1;
}

export function waitlistClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) return first.slice(0, 80);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "unknown";
}

export function mailchimpSubscriberHash(email: string) {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

export type MailchimpConfig = {
  apiKey: string;
  server: string;
  audienceId: string;
  doubleOptIn: boolean;
};

const SERVER_RE = /^[a-z]{2}\d{1,3}$/;
const AUDIENCE_RE = /^[a-z0-9]{6,32}$/i;

export function readMailchimpConfig(
  env: Record<string, string | undefined> = process.env,
): MailchimpConfig | null {
  const apiKey = env.MAILCHIMP_API_KEY?.trim() ?? "";
  const server = env.MAILCHIMP_SERVER_PREFIX?.trim().toLowerCase() ?? "";
  const audienceId = env.MAILCHIMP_AUDIENCE_ID?.trim() ?? "";
  if (!apiKey || !server || !audienceId) return null;
  if (!SERVER_RE.test(server) || !AUDIENCE_RE.test(audienceId)) return null;
  const flag = (env.MAILCHIMP_DOUBLE_OPTIN ?? "").trim().toLowerCase();
  return {
    apiKey,
    server,
    audienceId,
    doubleOptIn: flag === "true" || flag === "1",
  };
}

export type LaunchWaitlistResult =
  | { status: "subscribed"; firstName: string }
  | { status: "already"; firstName: string };

type MailchimpOutcome = "created" | "exists" | "skipped" | "failed";

async function saveSignup(value: WaitlistInput): Promise<"created" | "duplicate"> {
  try {
    await prisma.waitlistSignup.create({
      data: {
        email: value.email,
        firstName: value.firstName,
        train: value.train,
        member: value.member,
        source: WAITLIST_SOURCE,
      },
    });
    return "created";
  } catch (error) {
    if (isUniqueConstraintError(error)) return "duplicate";
    throw error;
  }
}

function mailchimpAuth(apiKey: string) {
  return `Basic ${Buffer.from(`svg:${apiKey}`).toString("base64")}`;
}

async function drain(response: Response) {
  try {
    if (!response.bodyUsed) await response.arrayBuffer();
  } catch {
    // Status is enough when the body is empty or already closed.
  }
}

async function mailchimpRequest(
  config: MailchimpConfig,
  path: string,
  init?: { method?: string; body?: unknown },
) {
  return fetch(`https://${config.server}.api.mailchimp.com/3.0${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: mailchimpAuth(config.apiKey),
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
}

async function readMailchimpError(response: Response) {
  try {
    const data = (await response.json()) as { title?: unknown; detail?: unknown };
    return `${String(data?.title ?? "")} ${String(data?.detail ?? "")}`;
  } catch {
    return "";
  }
}

function memberBody(config: MailchimpConfig, value: WaitlistInput) {
  return {
    email_address: value.email,
    status_if_new: config.doubleOptIn ? "pending" : "subscribed",
    merge_fields: {
      FNAME: value.firstName,
      TRAIN: value.train,
      MEMBER: value.member satisfies WaitlistMember,
    },
  };
}

/** PUT the member, then add the waitlist tag. Throws when Mailchimp cannot be reached. */
async function pushMailchimp(
  config: MailchimpConfig,
  value: WaitlistInput,
): Promise<"created" | "exists"> {
  const hash = mailchimpSubscriberHash(value.email);
  const memberPath = `/lists/${config.audienceId}/members/${hash}`;
  const lookup = await mailchimpRequest(config, memberPath);
  let outcome: "created" | "exists";
  if (lookup.status === 200) {
    await drain(lookup);
    outcome = "exists";
  } else if (lookup.status === 404) {
    await drain(lookup);
    const created = await mailchimpRequest(config, memberPath, {
      method: "PUT",
      body: memberBody(config, value),
    });
    if (created.ok) {
      await drain(created);
      outcome = "created";
    } else {
      const detail = await readMailchimpError(created);
      if (created.status === 400 && /member exists/i.test(detail)) {
        outcome = "exists";
      } else {
        throw new Error(`mailchimp subscribe ${created.status}`);
      }
    }
  } else {
    await drain(lookup);
    throw new Error(`mailchimp lookup ${lookup.status}`);
  }

  try {
    const tagged = await mailchimpRequest(config, `${memberPath}/tags`, {
      method: "POST",
      body: { tags: [{ name: WAITLIST_TAG, status: "active" }] },
    });
    if (!tagged.ok) {
      console.error(`waitlist tag failed: ${tagged.status}`);
    }
    await drain(tagged);
  } catch {
    console.error("waitlist tag failed");
  }
  return outcome;
}

export async function joinLaunchWaitlist(input: {
  body: unknown;
  ip: string;
}): Promise<LaunchWaitlistResult> {
  assertWaitlistRateLimit(input.ip);
  if (honeypotFilled(input.body)) {
    const record =
      input.body && typeof input.body === "object" && !Array.isArray(input.body)
        ? (input.body as Record<string, unknown>)
        : {};
    const firstName = typeof record.firstName === "string" ? record.firstName.trim().slice(0, 80) : "";
    return { status: "subscribed", firstName };
  }

  const parsed = parseWaitlistBody(input.body);
  if (!parsed.ok) {
    throw new AppError("WAITLIST", parsed.error, 400);
  }
  const value = parsed.value;

  const existing = await prisma.waitlistSignup.findUnique({ where: { email: value.email } });
  if (existing) {
    return { status: "already", firstName: value.firstName };
  }

  const config = readMailchimpConfig();
  let mailchimp: MailchimpOutcome = config ? "failed" : "skipped";
  if (config) {
    try {
      mailchimp = await pushMailchimp(config, value);
    } catch {
      console.error("waitlist mailchimp failed");
      mailchimp = "failed";
    }
  }

  try {
    const saved = await saveSignup(value);
    if (saved === "duplicate" || mailchimp === "exists") {
      return { status: "already", firstName: value.firstName };
    }
  } catch (error) {
    console.error("waitlist backup failed");
    if (mailchimp === "created") {
      return { status: "subscribed", firstName: value.firstName };
    }
    if (mailchimp === "exists") {
      return { status: "already", firstName: value.firstName };
    }
    throw error;
  }

  return { status: "subscribed", firstName: value.firstName };
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export async function waitlistSignupsCsv() {
  const rows = await prisma.waitlistSignup.findMany({ orderBy: { createdAt: "asc" } });
  const header = ["email", "first_name", "train", "member", "created_at", "source"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.email),
        csvCell(row.firstName),
        csvCell(row.train),
        csvCell(row.member),
        csvCell(row.createdAt.toISOString()),
        csvCell(row.source),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
