import packageJson from "../../package.json";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { adminEmailsFromEnv } from "@/lib/form-check-access";
import { reminderEmailHtml, sendMail } from "@/lib/mail";
import { performanceAppOrigin } from "@/lib/reminders";
import { isFeedbackAdmin } from "@/lib/feedback-access";
import {
  readFeedbackMedia,
  validateFeedbackImageBytes,
  writeFeedbackMedia,
} from "@/lib/feedback-storage";
import {
  FEEDBACK_MAX_MESSAGE,
  FEEDBACK_MAX_PER_WINDOW,
  FEEDBACK_MIN_MESSAGE,
  FEEDBACK_RATE_MESSAGE,
  FEEDBACK_WINDOW_MS,
  feedbackTypeLabel,
  isFeedbackStatus,
  isFeedbackType,
  sanitizeFeedbackRoute,
  sanitizeUserAgent,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback-shared";

export {
  FEEDBACK_MAX_PER_WINDOW,
  FEEDBACK_RATE_MESSAGE,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_WINDOW_MS,
  feedbackInboxHref,
  feedbackStatusLabel,
  feedbackTypeLabel,
  isFeedbackStatus,
  isFeedbackType,
  sanitizeFeedbackRoute,
  sanitizeUserAgent,
} from "@/lib/feedback-shared";

export function appVersionLabel(env: NodeJS.ProcessEnv = process.env) {
  const version = packageJson.version || "0.0.0";
  const sha = (env.VERCEL_GIT_COMMIT_SHA || env.GIT_COMMIT_SHA || "").trim();
  const short = sha.slice(0, 7);
  return short ? `${version}+${short}` : version;
}

export async function ownedWorkoutId(userId: string, raw: string) {
  const id = raw.trim();
  if (!id || !/^[a-z0-9]{8,40}$/i.test(id)) return "";
  const row = await prisma.workoutSession.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  return row?.id ?? "";
}

export async function resolveFeedbackContext(
  userId: string,
  input: { from?: string; workout?: string },
) {
  const route = sanitizeFeedbackRoute(input.from ?? "") || "/feedback";
  const workoutId = await ownedWorkoutId(userId, input.workout ?? "");
  return { route, workoutId };
}

function cleanMessage(raw: string) {
  const message = raw.replace(/\r\n/g, "\n").trim();
  if (message.length < FEEDBACK_MIN_MESSAGE) {
    throw new AppError("FEEDBACK", "Write a few words so we know what to look at.");
  }
  if (message.length > FEEDBACK_MAX_MESSAGE) {
    throw new AppError("FEEDBACK", "Keep the note under 2,000 characters.");
  }
  return message;
}

async function assertFeedbackRateLimit(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - FEEDBACK_WINDOW_MS);
  const count = await prisma.memberFeedback.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= FEEDBACK_MAX_PER_WINDOW) {
    throw new AppError("RATE", FEEDBACK_RATE_MESSAGE, 429);
  }
}

export function buildFeedbackAdminEmail(input: {
  typeLabel: string;
  message: string;
  email: string;
  userId: string;
  route: string;
  workoutId: string;
  appVersion: string;
  inboxHref: string;
}) {
  const subject = `SVG feedback: ${input.typeLabel}`;
  const items = [
    { label: "Type", message: input.typeLabel },
    { label: "From", message: `${input.email} · ${input.userId}` },
    { label: "Page", message: input.route || "—" },
    ...(input.workoutId ? [{ label: "Workout", message: input.workoutId }] : []),
    { label: "App", message: input.appVersion || "—" },
    { label: "Note", message: input.message.replace(/\s+/g, " ").trim() },
  ];
  const text = [
    "MEMBER FEEDBACK",
    "SVG PERFORMANCE",
    "NEW NOTE",
    "",
    `Type: ${input.typeLabel}`,
    `From: ${input.email}`,
    `User: ${input.userId}`,
    `Page: ${input.route || "—"}`,
    input.workoutId ? `Workout: ${input.workoutId}` : "",
    `App: ${input.appVersion || "—"}`,
    "",
    input.message,
    "",
    "Open inbox:",
    input.inboxHref,
    "",
    "Open the inbox to mark it reviewed.",
  ]
    .filter((line) => line !== "")
    .join("\n");
  const html = reminderEmailHtml({
    eyebrow: "Member feedback",
    headline: "New note",
    intro: "A member sent a note from the app.",
    items,
    ctaLabel: "Open inbox",
    ctaHref: input.inboxHref,
    pull: "Open the inbox to mark it reviewed.",
    profileHref: input.inboxHref,
    footer: "You are receiving this because your email is on the SVG Performance admin list.",
    preheader: `${input.typeLabel} from ${input.email}`,
  });
  return { subject, text, html };
}

async function notifyAdminsOfFeedback(input: {
  id: string;
  typeLabel: string;
  message: string;
  email: string;
  userId: string;
  route: string;
  workoutId: string;
  appVersion: string;
}) {
  try {
    const recipients = adminEmailsFromEnv();
    if (recipients.length === 0) return { emailed: 0 };
    const origin = performanceAppOrigin();
    const mail = buildFeedbackAdminEmail({
      ...input,
      inboxHref: `${origin}/admin/feedback`,
    });
    let emailed = 0;
    for (const to of recipients) {
      const result = await sendMail({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      if (result.sent) emailed += 1;
    }
    return { emailed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Feedback email failed:", input.id, message);
    return { emailed: 0 };
  }
}

export async function createMemberFeedback(input: {
  userId: string;
  userEmail: string;
  type: string;
  message: string;
  route: string;
  workoutId: string;
  userAgent: string;
  bytes?: Uint8Array | null;
  claimedType?: string;
  now?: Date;
}) {
  if (!isFeedbackType(input.type)) {
    throw new AppError("FEEDBACK", "Pick Bug, Idea, Workout feedback, or Other.");
  }
  const message = cleanMessage(input.message);
  const route = sanitizeFeedbackRoute(input.route);
  const workoutId = await ownedWorkoutId(input.userId, input.workoutId);
  const userAgent = sanitizeUserAgent(input.userAgent);
  const appVersion = appVersionLabel();
  const now = input.now ?? new Date();
  await assertFeedbackRateLimit(input.userId, now);

  const hasFile = Boolean(input.bytes && input.bytes.byteLength > 0);
  const mime = hasFile ? validateFeedbackImageBytes(input.bytes!, input.claimedType) : null;

  const created = await prisma.memberFeedback.create({
    data: {
      userId: input.userId,
      userEmail: input.userEmail,
      type: input.type,
      message,
      route,
      workoutId,
      appVersion,
      userAgent,
      status: "new",
      createdAt: now,
    },
  });

  let row = created;
  if (mime && input.bytes) {
    try {
      const stored = await writeFeedbackMedia({
        userId: input.userId,
        feedbackId: created.id,
        bytes: input.bytes,
        mime,
      });
      row = await prisma.memberFeedback.update({
        where: { id: created.id },
        data: {
          storageKind: stored.storageKind,
          storageKey: stored.storageKey,
          mimeType: mime,
          byteSize: input.bytes.byteLength,
        },
      });
    } catch (error) {
      await prisma.memberFeedback.delete({ where: { id: created.id } }).catch(() => undefined);
      throw error;
    }
  }

  await notifyAdminsOfFeedback({
    id: row.id,
    typeLabel: feedbackTypeLabel(row.type),
    message: row.message,
    email: row.userEmail,
    userId: row.userId,
    route: row.route,
    workoutId: row.workoutId,
    appVersion: row.appVersion,
  });

  return row;
}

function assertAdmin(actor: { role: string; email: string }) {
  if (!isFeedbackAdmin(actor)) {
    throw new ForbiddenError("Only an admin can review member feedback.");
  }
}

export async function listMemberFeedback(
  actor: { role: string; email: string },
  filter: { type?: string; status?: string } = {},
) {
  assertAdmin(actor);
  const type = filter.type && isFeedbackType(filter.type) ? filter.type : undefined;
  const status = filter.status && isFeedbackStatus(filter.status) ? filter.status : undefined;
  return prisma.memberFeedback.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });
}

export async function setMemberFeedbackStatus(input: {
  actor: { role: string; email: string };
  feedbackId: string;
  status: string;
}) {
  assertAdmin(input.actor);
  if (!isFeedbackStatus(input.status)) {
    throw new AppError("FEEDBACK", "Pick New, Reviewed, or Done.");
  }
  const row = await prisma.memberFeedback.findUnique({ where: { id: input.feedbackId } });
  if (!row) throw new NotFoundError("That feedback note was not found.");
  if (row.status === input.status) return row;
  return prisma.memberFeedback.update({
    where: { id: row.id },
    data: { status: input.status satisfies FeedbackStatus },
  });
}

export async function readFeedbackImageForActor(
  feedbackId: string,
  actor: { id: string; role: string; email: string },
) {
  assertAdmin(actor);
  const row = await prisma.memberFeedback.findUnique({ where: { id: feedbackId } });
  if (!row || !row.storageKey || !row.mimeType) {
    throw new NotFoundError("That screenshot is missing.");
  }
  const bytes = await readFeedbackMedia({
    userId: row.userId,
    storageKind: row.storageKind,
    storageKey: row.storageKey,
  });
  return { row, bytes };
}

export type { FeedbackStatus, FeedbackType };
