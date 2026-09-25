import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError, AuthError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe";
import { progressPhotoRoot } from "@/lib/progress-photos";
import { trainingClipRoot } from "@/lib/clips";
import type { PublicUser } from "@/lib/auth";

const EXPORT_WINDOW_MS = 15 * 60 * 1000;
const EXPORT_MAX_PER_WINDOW = 5;

const exportHits = new Map<string, number[]>();

export function resetAccountExportRateLimit() {
  exportHits.clear();
}

export function requireSignedInAccount(user: PublicUser | null): PublicUser {
  if (!user) {
    throw new AuthError("Sign in to download or delete your data.");
  }
  return user;
}

export function assertAccountExportRateLimit(userId: string, now = Date.now()) {
  const recent = (exportHits.get(userId) ?? []).filter((stamp) => now - stamp < EXPORT_WINDOW_MS);
  if (recent.length >= EXPORT_MAX_PER_WINDOW) {
    throw new AppError(
      "RATE",
      "You already downloaded your data a few times. Wait about 15 minutes and try again.",
      429,
    );
  }
  recent.push(now);
  exportHits.set(userId, recent);
}

export function accountExportFilename(date = new Date()) {
  return `svg-performance-data-${date.toISOString().slice(0, 10)}.json`;
}

export function isDeleteConfirmation(input: string, email: string) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return trimmed === "DELETE" || trimmed.toLowerCase() === email.trim().toLowerCase();
}

function jsonSafe<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function exportAccountData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    throw new AuthError("Sign in to download or delete your data.");
  }

  const [
    profile,
    workoutSessions,
    exerciseNotes,
    nutritionEntries,
    savedMeals,
    lessonProgress,
    chatThreads,
    subscriptions,
    reminderPrefs,
    coachAsMember,
    coachAsCoach,
    helpRequests,
    bodyMetrics,
    bodyPhotoPlaceholders,
    progressPhotos,
    coachingCredits,
    planWaitlist,
    bookingRequests,
    pathEnrollments,
    pathCompletions,
    journalEntries,
    weeklyComments,
    coachingAdjustments,
    polarConnection,
    hrRestingSamples,
    hrWorkoutSessions,
    trainingClips,
    challengeEnrollments,
    groceryLists,
    metricEvents,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.workoutSession.findMany({
      where: { userId },
      include: { sets: { orderBy: { sortOrder: "asc" } } },
      orderBy: { performedAt: "desc" },
    }),
    prisma.exerciseNote.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.nutritionEntry.findMany({ where: { userId }, orderBy: { eatenAt: "desc" } }),
    prisma.savedMeal.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.lessonProgress.findMany({
      where: { userId },
      include: { lesson: { select: { slug: true, title: true } } },
    }),
    prisma.chatThread.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reminderPrefs.findUnique({ where: { userId } }),
    prisma.coachAssignment.findMany({ where: { memberUserId: userId } }),
    prisma.coachAssignment.findMany({ where: { coachUserId: userId } }),
    prisma.helpRequest.findMany({ where: { memberUserId: userId }, orderBy: { createdAt: "desc" } }),
    prisma.bodyMetric.findMany({ where: { userId }, orderBy: { recordedAt: "desc" } }),
    prisma.bodyPhotoPlaceholder.findMany({ where: { userId } }),
    prisma.progressPhoto.findMany({
      where: { userId },
      select: {
        id: true,
        caption: true,
        mimeType: true,
        byteSize: true,
        recordedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.coachingCredit.findMany({ where: { userId } }),
    prisma.planWaitlist.findMany({ where: { userId } }),
    prisma.bookingRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.pathEnrollment.findMany({ where: { userId } }),
    prisma.pathStepCompletion.findMany({ where: { userId } }),
    prisma.journalEntry.findMany({
      where: { userId },
      include: { feedback: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.weeklyCoachComment.findMany({ where: { userId } }),
    prisma.coachingAdjustment.findMany({ where: { userId } }),
    prisma.polarConnection.findUnique({
      where: { userId },
      select: {
        polarUserId: true,
        connectedAt: true,
        lastSyncedAt: true,
        lastError: true,
        expiresAt: true,
      },
    }),
    prisma.hrRestingSample.findMany({ where: { userId }, orderBy: { recordedAt: "desc" } }),
    prisma.hrWorkoutSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" } }),
    prisma.trainingClip.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        mimeType: true,
        byteSize: true,
        memberNote: true,
        feedbackSeenAt: true,
        createdAt: true,
      },
    }),
    prisma.challengeEnrollment.findMany({
      where: { userId },
      include: { challenge: { select: { title: true, monthKey: true } } },
    }),
    prisma.groceryList.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.metricEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  return jsonSafe({
    exportedAt: new Date().toISOString(),
    account: user,
    profile,
    gymMembership: profile
      ? {
          claimsGymMembership: profile.claimsGymMembership,
          gymMembershipVerified: profile.gymMembershipVerified,
        }
      : null,
    workoutSessions,
    exerciseNotes,
    nutritionEntries,
    savedMeals,
    lessonProgress,
    coachChat: chatThreads,
    subscriptions: subscriptions.map((row) => ({
      id: row.id,
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd,
      source: row.source,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    reminderPrefs,
    coachAssignments: [
      ...coachAsMember.map((row) => ({ side: "member" as const, createdAt: row.createdAt })),
      ...coachAsCoach.map((row) => ({ side: "coach" as const, createdAt: row.createdAt })),
    ],
    helpRequests,
    bodyMetrics,
    bodyPhotoPlaceholders,
    progressPhotos,
    coachingCredits,
    planWaitlist,
    bookingRequests,
    pathEnrollments,
    pathCompletions,
    journalEntries: journalEntries.map((entry) => ({
      ...entry,
      feedback: entry.feedback.map((item) => ({
        id: item.id,
        body: item.body,
        actionItems: item.actionItems,
        createdAt: item.createdAt,
      })),
    })),
    weeklyComments: weeklyComments.map((row) => ({
      id: row.id,
      weekStartKey: row.weekStartKey,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    coachingAdjustments: coachingAdjustments.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
    })),
    polarConnection: polarConnection
      ? { connected: true, ...polarConnection }
      : { connected: false },
    heart: {
      restingSamples: hrRestingSamples,
      workoutSessions: hrWorkoutSessions,
    },
    trainingClips,
    challengeEnrollments,
    groceryLists,
    metricEvents,
  });
}

export async function exportAccountDataForUser(user: PublicUser | null) {
  const signedIn = requireSignedInAccount(user);
  assertAccountExportRateLimit(signedIn.id);
  return exportAccountData(signedIn.id);
}

async function cancelStripeSubscriptions(userId: string) {
  const rows = await prisma.subscription.findMany({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });
  const activeRefs = rows.filter(
    (row) =>
      row.stripeSubscriptionId &&
      (row.status === "active" || row.status === "past_due" || row.status === "incomplete"),
  );
  if (activeRefs.length === 0) return { attempted: 0, canceled: 0, skippedNoKeys: false };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    stripe = null;
  }
  if (!stripe) {
    // Stripe TEST keys are optional in this preview. Local rows still delete.
    return { attempted: activeRefs.length, canceled: 0, skippedNoKeys: true };
  }

  let canceled = 0;
  for (const row of activeRefs) {
    try {
      await stripe.subscriptions.cancel(row.stripeSubscriptionId);
      canceled += 1;
    } catch {
      // Do not block account deletion if Stripe is unreachable.
    }
  }
  return { attempted: activeRefs.length, canceled, skippedNoKeys: false };
}

async function removeUserUploadDirs(userId: string) {
  await Promise.all([
    rm(path.join(progressPhotoRoot(), userId), { recursive: true, force: true }),
    rm(path.join(trainingClipRoot(), userId), { recursive: true, force: true }),
  ]);
}

export async function deleteAccountForUser(user: PublicUser | null, confirmation: string) {
  const signedIn = requireSignedInAccount(user);
  if (!isDeleteConfirmation(confirmation, signedIn.email)) {
    throw new AppError(
      "DELETE",
      "Type DELETE or your email exactly to confirm you want this account gone.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: signedIn.id } });
  if (!existing) {
    throw new AuthError("Sign in to download or delete your data.");
  }

  await cancelStripeSubscriptions(signedIn.id);

  await prisma.$transaction(async (tx) => {
    await tx.journalFeedback.deleteMany({ where: { authorUserId: signedIn.id } });
    await tx.weeklyCoachComment.deleteMany({ where: { authorUserId: signedIn.id } });
    await tx.coachingAdjustment.deleteMany({ where: { authorUserId: signedIn.id } });
    await tx.clipTimestampNote.deleteMany({ where: { authorUserId: signedIn.id } });
    await tx.metricEvent.deleteMany({ where: { userId: signedIn.id } });
    await tx.user.delete({ where: { id: signedIn.id } });
  });

  await removeUserUploadDirs(signedIn.id);
  return { deleted: true as const, email: signedIn.email };
}
