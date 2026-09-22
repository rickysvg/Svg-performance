import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { assertCanViewMemberTrend } from "@/lib/reports";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview } from "@/lib/plans";

export const JOURNAL_KINDS = ["goal", "note", "question", "lesson"] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

export const JOURNAL_KIND_LABELS: Record<JournalKind, string> = {
  goal: "Goal",
  note: "Training note",
  question: "Question",
  lesson: "Lesson learned",
};

export function isJournalKind(value: string): value is JournalKind {
  return (JOURNAL_KINDS as readonly string[]).includes(value);
}

export async function createJournalEntryForUser(
  userId: string,
  input: { kind: string; title: string; body: string },
) {
  if (!isJournalKind(input.kind)) {
    throw new AppError("JOURNAL", "Pick a goal, note, question, or lesson learned.");
  }
  const title = input.title.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 4000);
  if (!title || !body) {
    throw new AppError("JOURNAL", "Add a short title and some words.");
  }
  return prisma.journalEntry.create({
    data: { userId, kind: input.kind, title, body },
  });
}

export async function listJournalEntriesForUser(userId: string, search = "") {
  const query = search.trim();
  return prisma.journalEntry.findMany({
    where: {
      userId,
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { body: { contains: query } },
            ],
          }
        : {}),
    },
    include: { feedback: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJournalEntryForUser(userId: string, entryId: string) {
  const row = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { feedback: { orderBy: { createdAt: "desc" } } },
  });
  if (!row || row.userId !== userId) {
    throw new NotFoundError("Journal entry not found.");
  }
  return row;
}

export async function deleteJournalEntryForUser(userId: string, entryId: string) {
  const row = await prisma.journalEntry.findUnique({ where: { id: entryId } });
  if (!row || row.userId !== userId) {
    throw new ForbiddenError("You can only delete your own journal entry.");
  }
  return prisma.journalEntry.delete({ where: { id: entryId } });
}

export async function addJournalFeedback(input: {
  staffUserId: string;
  staffRole: string;
  entryId: string;
  body: string;
  actionItems: string;
}) {
  const entry = await prisma.journalEntry.findUnique({ where: { id: input.entryId } });
  if (!entry) {
    throw new NotFoundError("Journal entry not found.");
  }
  await assertCanViewMemberTrend({
    staffUserId: input.staffUserId,
    staffRole: input.staffRole,
    memberUserId: entry.userId,
  });
  const planId = await getEffectivePlanId(entry.userId);
  if (!planHasCoachReview(planId)) {
    throw new AppError(
      "JOURNAL",
      "Coach feedback is for Fighter Development and higher. The member still owns their notes.",
    );
  }
  const body = input.body.trim().slice(0, 2000);
  if (!body) {
    throw new AppError("JOURNAL", "Write the feedback in your own words. Do not leave a fake Ricky note.");
  }
  return prisma.journalFeedback.create({
    data: {
      entryId: entry.id,
      authorUserId: input.staffUserId,
      body,
      actionItems: input.actionItems.trim().slice(0, 1000),
    },
  });
}

export async function listJournalEntriesForStaff(input: {
  staffUserId: string;
  staffRole: string;
  memberUserId: string;
}) {
  await assertCanViewMemberTrend({
    staffUserId: input.staffUserId,
    staffRole: input.staffRole,
    memberUserId: input.memberUserId,
  });
  return listJournalEntriesForUser(input.memberUserId);
}
