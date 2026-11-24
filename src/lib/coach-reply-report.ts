import { prisma } from "@/lib/prisma";
import { ForbiddenError, isUniqueConstraintError } from "@/lib/errors";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { supportEmail } from "@/lib/support";

export const COACH_REPORT_REASONS = ["offensive", "harmful", "wrong", "other"] as const;
export type CoachReportReason = (typeof COACH_REPORT_REASONS)[number];

export function isCoachReportReason(value: string): value is CoachReportReason {
  return (COACH_REPORT_REASONS as readonly string[]).includes(value);
}

export async function reportCoachReply(input: {
  userId: string;
  messageId: string;
  reason: string;
  note?: string;
}) {
  if (!isCoachReportReason(input.reason)) {
    throw new ForbiddenError("Pick a reason for the report.");
  }
  const message = await prisma.chatMessage.findUnique({
    where: { id: input.messageId },
    include: { thread: { select: { userId: true } } },
  });
  if (!message || message.thread.userId !== input.userId || message.role !== "assistant") {
    throw new ForbiddenError("You can only report your own coach replies.");
  }
  try {
    const row = await prisma.coachReplyReport.create({
      data: {
        userId: input.userId,
        messageId: input.messageId,
        reason: input.reason,
        note: (input.note ?? "").trim().slice(0, 500),
      },
    });
    if (isSmtpConfigured()) {
      await sendMail({
        to: supportEmail(),
        subject: "AI coach reply reported",
        text: `A member reported an AI coach reply.\nReason: ${input.reason}\nMessage id: ${input.messageId}\nReview it in the admin desk.`,
      });
    }
    return { id: row.id, already: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.coachReplyReport.findUnique({
      where: { userId_messageId: { userId: input.userId, messageId: input.messageId } },
    });
    return { id: existing?.id ?? "", already: true };
  }
}

export async function listCoachReplyReports(status: "open" | "reviewed" | "all" = "open") {
  return prisma.coachReplyReport.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });
}

export async function markCoachReplyReviewed(reportId: string) {
  await prisma.coachReplyReport.update({
    where: { id: reportId },
    data: { status: "reviewed" },
  });
}
