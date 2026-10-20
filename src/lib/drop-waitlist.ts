export const DROP_AT_ISO = "2026-11-16T07:00:00.000Z";
export const ACADEMY_SITE = "https://svgmmaacademy.com";

export type AcademyTag = "academy-member" | "non-member";

export type WaitlistState =
  | "pending"
  | "exists"
  | "invalid"
  | "consent"
  | "rate"
  | "unconfigured"
  | "error";

export type WaitlistResponse = {
  state: WaitlistState;
  message: string;
};

export type MailchimpConfig = {
  apiKey: string;
  serverPrefix: string;
  audienceId: string;
  /** Local mock only. Production leaves this empty and calls Mailchimp. */
  apiBase?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SERVER_PREFIX = /^[a-z]{2}\d{1,3}$/i;
const AUDIENCE_ID = /^[a-z0-9]+$/i;
const LOCAL_BASE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i;

export function readMailchimpConfig(
  env: Record<string, string | undefined> = process.env,
): MailchimpConfig | null {
  const apiKey = env.MAILCHIMP_API_KEY?.trim() ?? "";
  const serverPrefix = env.MAILCHIMP_SERVER_PREFIX?.trim() ?? "";
  const audienceId = env.MAILCHIMP_AUDIENCE_ID?.trim() ?? "";
  if (!apiKey || !SERVER_PREFIX.test(serverPrefix) || !AUDIENCE_ID.test(audienceId)) {
    return null;
  }
  const apiBase = env.MAILCHIMP_API_BASE?.trim().replace(/\/$/, "") ?? "";
  return {
    apiKey,
    serverPrefix,
    audienceId,
    apiBase: LOCAL_BASE.test(apiBase) ? apiBase : undefined,
  };
}

export function mailchimpMembersUrl(config: MailchimpConfig) {
  const base = config.apiBase ?? `https://${config.serverPrefix}.api.mailchimp.com/3.0`;
  return `${base}/lists/${encodeURIComponent(config.audienceId)}/members`;
}

export function normalizeWaitlistEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

export function normalizeFirstName(value: unknown) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (name.length > 40 || !/^[\p{L}][\p{L}\s'.-]*$/u.test(name)) return null;
  return name;
}

export function academyTag(value: unknown): AcademyTag | null {
  if (value === "yes") return "academy-member";
  if (value === "no") return "non-member";
  return null;
}

export function waitlistMessage(state: WaitlistState): string {
  switch (state) {
    case "pending":
      return "Check your email. Mailchimp sent a confirmation so you can finish joining.";
    case "exists":
      return "You're already on the list. Check your inbox if the confirmation is still waiting.";
    case "invalid":
      return "Enter a valid email address.";
    case "consent":
      return "Check the box so we can email you about the drop.";
    case "rate":
      return "Too many tries. Wait a few minutes and try again.";
    case "unconfigured":
      return "The list is coming soon. Check back before Nov 16.";
    case "error":
      return "We couldn't add you just now. Try again in a minute.";
  }
}

type MailchimpErrorBody = { title?: string; detail?: string };

function isMemberExists(status: number, body: MailchimpErrorBody) {
  if (status !== 400) return false;
  const title = body.title ?? "";
  const detail = body.detail ?? "";
  return title === "Member Exists" || /already a list member/i.test(detail);
}

export async function subscribeToAudience(input: {
  config: MailchimpConfig;
  email: string;
  firstName: string;
  tag: AcademyTag;
  fetchImpl?: typeof fetch;
}): Promise<WaitlistState> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const payload: {
    email_address: string;
    status: "pending";
    tags: [AcademyTag];
    merge_fields?: { FNAME: string };
  } = {
    email_address: input.email,
    status: "pending",
    tags: [input.tag],
  };
  if (input.firstName) payload.merge_fields = { FNAME: input.firstName };

  let response: Response;
  try {
    response = await fetchImpl(mailchimpMembersUrl(input.config), {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`anystring:${input.config.apiKey}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return "error";
  }

  if (response.ok) return "pending";
  let body: MailchimpErrorBody = {};
  try {
    body = (await response.json()) as MailchimpErrorBody;
  } catch {
    body = {};
  }
  if (isMemberExists(response.status, body)) return "exists";
  return "error";
}
