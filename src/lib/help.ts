import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";

export const HELP_TOPICS = [
  "training",
  "class",
  "lesson",
  "food-log-question",
  "other",
] as const;

export const HELP_STATUSES = ["open", "seen", "closed"] as const;
export type HelpStatus = (typeof HELP_STATUSES)[number];

export function isHelpStatus(value: string): value is HelpStatus {
  return HELP_STATUSES.includes(value as HelpStatus);
}

export async function createHelpRequest(input: {
  memberUserId: string;
  topic: string;
  note: string;
}) {
  const topic = input.topic.trim();
  if (!HELP_TOPICS.includes(topic as (typeof HELP_TOPICS)[number])) {
    throw new AppError("HELP", "Pick a topic for the coach.");
  }
  const note = input.note.trim().slice(0, 500);
  if (!note) {
    throw new AppError("HELP", "Add a short note so the coach knows what you need.");
  }
  const row = await prisma.helpRequest.create({
    data: {
      memberUserId: input.memberUserId,
      topic,
      note,
      status: "open",
    },
  });
  await recordMetric(METRIC_NAMES.helpRequested, input.memberUserId);
  return row;
}

export async function listHelpRequestsForMember(memberUserId: string) {
  return prisma.helpRequest.findMany({
    where: { memberUserId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listHelpRequestsForStaff(input: {
  staffUserId: string;
  staffRole: string;
}) {
  if (input.staffRole === "admin") {
    return prisma.helpRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        member: { include: { profile: true } },
      },
    });
  }
  if (input.staffRole !== "coach") {
    throw new ForbiddenError("Only a coach or admin can open the help inbox.");
  }
  const assigned = await prisma.coachAssignment.findMany({
    where: { coachUserId: input.staffUserId },
    select: { memberUserId: true },
  });
  const ids = assigned.map((row) => row.memberUserId);
  return prisma.helpRequest.findMany({
    where: { memberUserId: { in: ids } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      member: { include: { profile: true } },
    },
  });
}

export async function setHelpRequestStatus(input: {
  staffUserId: string;
  staffRole: string;
  requestId: string;
  status: HelpStatus;
}) {
  const request = await prisma.helpRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request) {
    throw new AppError("HELP", "That help request was not found.");
  }
  if (input.staffRole === "coach") {
    const assigned = await prisma.coachAssignment.findUnique({
      where: {
        coachUserId_memberUserId: {
          coachUserId: input.staffUserId,
          memberUserId: request.memberUserId,
        },
      },
    });
    if (!assigned) {
      throw new ForbiddenError("You can only update help requests for assigned members.");
    }
  } else if (input.staffRole !== "admin") {
    throw new ForbiddenError("Only a coach or admin can update help requests.");
  }
  return prisma.helpRequest.update({
    where: { id: input.requestId },
    data: { status: input.status },
  });
}
