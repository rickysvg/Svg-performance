import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { canUseFeature } from "@/lib/entitlements";
import { zonedCivilToUtc, zonedParts } from "@/lib/timezone";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import {
  assertClipDuration,
  readFormCheckMedia,
  validateFormCheckBytes,
  writeFormCheckMedia,
  type FormCheckMime,
} from "@/lib/form-check-storage";
import {
  FORM_CHECK_MONTHLY_LIMIT,
  FORM_CHECK_MOVEMENTS,
  FORM_CHECK_SIGNATURE,
  FORM_CHECK_STATUS_LABEL,
  type FormCheckStatus,
} from "@/lib/form-check-shared";

export {
  FORM_CHECK_MAX_BYTES,
  FORM_CHECK_MAX_SECONDS,
  FORM_CHECK_MONTHLY_LIMIT,
  FORM_CHECK_MOVEMENTS,
  FORM_CHECK_SIGNATURE,
  FORM_CHECK_STATUS_LABEL,
  FORM_CHECK_TURNAROUND,
  type FormCheckMovementId,
  type FormCheckStatus,
} from "@/lib/form-check-shared";

export function isFormCheckStatus(value: string): value is FormCheckStatus {
  return value === "submitted" || value === "in_review" || value === "reviewed";
}

export function formCheckStatusLabel(status: string) {
  return isFormCheckStatus(status) ? FORM_CHECK_STATUS_LABEL[status] : "Submitted";
}

export function formCheckMonthWindow(now: Date, timeZone: string) {
  const { year, month } = zonedParts(now, timeZone);
  const start = zonedCivilToUtc(year, month, 1, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = zonedCivilToUtc(nextYear, nextMonth, 1, timeZone);
  return {
    start,
    end,
    key: `${year}-${String(month).padStart(2, "0")}`,
  };
}

export function resolveMovement(movementId: string, custom: string) {
  const id = movementId.trim();
  if (id === "other") {
    const name = custom.trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      throw new AppError("FORM_CHECK", "Name the movement.");
    }
    return name.slice(0, 80);
  }
  const known = FORM_CHECK_MOVEMENTS.find((row) => row.id === id);
  if (!known || known.id === "other") {
    throw new AppError("FORM_CHECK", "Pick the movement in the clip.");
  }
  return known.label;
}

async function assertFormCheckAccess(userId: string, now: Date) {
  const allowed = await canUseFeature(userId, "form_check", now);
  if (!allowed) {
    throw new AppError(
      "PLAN",
      "Form check is on Performance. Paid plans coming soon.",
    );
  }
}

export async function formCheckUsage(userId: string, now: Date, timeZone: string) {
  const window = formCheckMonthWindow(now, timeZone);
  const used = await prisma.formCheck.count({
    where: {
      userId,
      submittedAt: { gte: window.start, lt: window.end },
    },
  });
  return {
    used,
    limit: FORM_CHECK_MONTHLY_LIMIT,
    remaining: Math.max(0, FORM_CHECK_MONTHLY_LIMIT - used),
    monthKey: window.key,
    start: window.start,
    end: window.end,
  };
}

export async function listFormChecksForUser(userId: string) {
  return prisma.formCheck.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
  });
}

export async function unseenFormCheckCount(userId: string) {
  return prisma.formCheck.count({
    where: {
      userId,
      status: "reviewed",
      feedbackSeenAt: null,
      feedback: { not: "" },
    },
  });
}

export async function markFormCheckFeedbackSeen(userId: string, now = new Date()) {
  await prisma.formCheck.updateMany({
    where: {
      userId,
      status: "reviewed",
      feedbackSeenAt: null,
    },
    data: { feedbackSeenAt: now },
  });
}

export type AthleteFormCheck = {
  id: string;
  movement: string;
  note: string;
  status: string;
  statusLabel: string;
  durationSeconds: number;
  feedback: string;
  reviewerLabel: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
};

export function presentFormCheckForAthlete(row: {
  id: string;
  movement: string;
  note: string;
  status: string;
  durationSeconds: number;
  feedback: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerUserId?: string;
}): AthleteFormCheck {
  const reviewed = row.status === "reviewed" && row.feedback.trim().length > 0;
  return {
    id: row.id,
    movement: row.movement,
    note: row.note,
    status: row.status,
    statusLabel: formCheckStatusLabel(row.status),
    durationSeconds: row.durationSeconds,
    feedback: reviewed ? row.feedback : "",
    reviewerLabel: reviewed ? FORM_CHECK_SIGNATURE : null,
    submittedAt: row.submittedAt,
    reviewedAt: reviewed ? row.reviewedAt : null,
  };
}

export async function createFormCheckForUser(input: {
  userId: string;
  movementId: string;
  customMovement: string;
  note: string;
  durationSeconds: number;
  bytes: Uint8Array;
  claimedType?: string;
  now: Date;
  timeZone: string;
}) {
  await assertFormCheckAccess(input.userId, input.now);
  const movement = resolveMovement(input.movementId, input.customMovement);
  const note = input.note.trim().slice(0, 500);
  const durationSeconds = assertClipDuration(input.durationSeconds);
  const mime: FormCheckMime = validateFormCheckBytes(input.bytes, input.claimedType);
  const usage = await formCheckUsage(input.userId, input.now, input.timeZone);
  if (usage.remaining <= 0) {
    throw new AppError(
      "FORM_CHECK",
      "You have used both form checks for this month. A new one opens next month.",
    );
  }

  const window = formCheckMonthWindow(input.now, input.timeZone);
  const row = await prisma.$transaction(async (tx) => {
    const used = await tx.formCheck.count({
      where: {
        userId: input.userId,
        submittedAt: { gte: window.start, lt: window.end },
      },
    });
    if (used >= FORM_CHECK_MONTHLY_LIMIT) {
      throw new AppError(
        "FORM_CHECK",
        "You have used both form checks for this month. A new one opens next month.",
      );
    }
    return tx.formCheck.create({
      data: {
        userId: input.userId,
        movement,
        note,
        status: "submitted",
        storageKind: "local",
        storageKey: "pending",
        mimeType: mime,
        byteSize: input.bytes.byteLength,
        durationSeconds,
        submittedAt: input.now,
      },
    });
  });

  try {
    const stored = await writeFormCheckMedia({
      userId: input.userId,
      checkId: row.id,
      bytes: input.bytes,
      mime,
    });
    return prisma.formCheck.update({
      where: { id: row.id },
      data: {
        storageKind: stored.storageKind,
        storageKey: stored.storageKey,
      },
    });
  } catch (error) {
    await prisma.formCheck.delete({ where: { id: row.id } }).catch(() => undefined);
    throw error;
  }
}

export async function readFormCheckForActor(
  checkId: string,
  actor: { id: string; email: string; role: string },
) {
  const row = await prisma.formCheck.findUnique({ where: { id: checkId } });
  if (!row) {
    throw new NotFoundError("Form check not found.");
  }
  if (row.userId !== actor.id && !isFormCheckReviewer(actor)) {
    throw new ForbiddenError("You cannot open another athlete's form check.");
  }
  const bytes = await readFormCheckMedia({
    userId: row.userId,
    storageKind: row.storageKind,
    storageKey: row.storageKey,
  });
  return { row, bytes };
}

function assertReviewer(actor: { id: string; email: string; role: string }) {
  if (!isFormCheckReviewer(actor)) {
    throw new ForbiddenError("Only an admin can review form checks.");
  }
}

export async function listFormChecksForReview() {
  return prisma.formCheck.findMany({
    orderBy: { submittedAt: "asc" },
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

export async function markFormCheckInReview(input: {
  actor: { id: string; email: string; role: string };
  checkId: string;
}) {
  assertReviewer(input.actor);
  const row = await prisma.formCheck.findUnique({ where: { id: input.checkId } });
  if (!row) throw new NotFoundError("Form check not found.");
  if (row.status === "reviewed") {
    throw new AppError("FORM_CHECK", "That clip is already reviewed. Update the note instead.");
  }
  return prisma.formCheck.update({
    where: { id: row.id },
    data: { status: "in_review" },
  });
}

export async function saveFormCheckFeedback(input: {
  actor: { id: string; email: string; role: string };
  checkId: string;
  feedback: string;
  now?: Date;
}) {
  assertReviewer(input.actor);
  const row = await prisma.formCheck.findUnique({ where: { id: input.checkId } });
  if (!row) throw new NotFoundError("Form check not found.");
  const feedback = input.feedback.trim();
  if (feedback.length < 2) {
    throw new AppError("FORM_CHECK", "Write the feedback before you mark it reviewed.");
  }
  if (feedback.length > 2000) {
    throw new AppError("FORM_CHECK", "Keep the feedback under 2,000 characters.");
  }
  return prisma.formCheck.update({
    where: { id: row.id },
    data: {
      status: "reviewed",
      feedback: feedback.slice(0, 2000),
      reviewerUserId: input.actor.id,
      reviewedAt: input.now ?? new Date(),
      feedbackSeenAt: null,
    },
  });
}
