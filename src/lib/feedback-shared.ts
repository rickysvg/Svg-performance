export const FEEDBACK_TYPES = ["bug", "idea", "workout", "other"] as const;
export const FEEDBACK_STATUSES = ["new", "reviewed", "done"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "Bug",
  idea: "Idea",
  workout: "Workout feedback",
  other: "Other",
};

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  done: "Done",
};

export const FEEDBACK_MAX_MESSAGE = 2000;
export const FEEDBACK_MIN_MESSAGE = 4;
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_MAX_PER_WINDOW = 5;
export const FEEDBACK_WINDOW_MS = 60 * 60 * 1000;

export const FEEDBACK_RATE_MESSAGE =
  "You sent a few notes recently. Give it a little time, then send another.";

export function isFeedbackType(value: string): value is FeedbackType {
  return (FEEDBACK_TYPES as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function feedbackTypeLabel(value: string) {
  return isFeedbackType(value) ? FEEDBACK_TYPE_LABEL[value] : "Other";
}

export function feedbackStatusLabel(value: string) {
  return isFeedbackStatus(value) ? FEEDBACK_STATUS_LABEL[value] : "New";
}

/** Keep an in-app path. Drop off-site or odd values. */
export function sanitizeFeedbackRoute(raw: string) {
  const value = raw.trim().slice(0, 240);
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  if (/[\s\\]/.test(value) || value.includes("..")) return "";
  if (!/^\/[A-Za-z0-9/_\-.?=&#%]*$/.test(value)) return "";
  return value;
}

export function sanitizeUserAgent(raw: string) {
  return raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
}

export function feedbackInboxHref(filter: { type?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filter.type && isFeedbackType(filter.type)) params.set("type", filter.type);
  if (filter.status && isFeedbackStatus(filter.status)) params.set("status", filter.status);
  const qs = params.toString();
  return qs ? `/admin/feedback?${qs}` : "/admin/feedback";
}
