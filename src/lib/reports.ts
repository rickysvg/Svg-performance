import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import {
  recentDifficultyAverage,
  tooEasyCoachNote,
  tooEasyStreak,
} from "@/lib/difficulty";

export type MemberTrend = {
  userId: string;
  email: string;
  displayName: string;
  workoutsLogged: number;
  lessonsCompleted: number;
  aiHandoffFlags: number;
  lastActiveAt: string | null;
  openHelpRequests: number;
  recentDifficultyLabel: string;
  tooEasyStreak: number;
  tooEasyNote: string;
};

function assertStaff(role: string) {
  if (role !== "admin" && role !== "coach") {
    throw new ForbiddenError("Only a coach or admin can open member reports.");
  }
}

export async function assignMemberToCoach(input: {
  adminUserId: string;
  coachUserId: string;
  memberUserId: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can assign coaches.");
  }
  const coach = await prisma.user.findUnique({ where: { id: input.coachUserId } });
  if (!coach || (coach.role !== "coach" && coach.role !== "admin")) {
    throw new AppError("STAFF", "Pick an account with the coach role.");
  }
  const member = await prisma.user.findUnique({ where: { id: input.memberUserId } });
  if (!member) {
    throw new AppError("STAFF", "That member was not found.");
  }
  return prisma.coachAssignment.upsert({
    where: {
      coachUserId_memberUserId: {
        coachUserId: input.coachUserId,
        memberUserId: input.memberUserId,
      },
    },
    create: {
      coachUserId: input.coachUserId,
      memberUserId: input.memberUserId,
    },
    update: {},
  });
}

export async function listAssignableUsers() {
  return prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { profile: true },
  });
}

export async function listCoachAssignments() {
  return prisma.coachAssignment.findMany({
    include: {
      coach: { include: { profile: true } },
      member: { include: { profile: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function memberIdsVisibleToStaff(staffUserId: string, staffRole: string) {
  if (staffRole === "admin") {
    const users = await prisma.user.findMany({
      where: { role: "member" },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }
  const assigned = await prisma.coachAssignment.findMany({
    where: { coachUserId: staffUserId },
    select: { memberUserId: true },
  });
  return assigned.map((row) => row.memberUserId);
}

/**
 * High-level trends only. Food diary rows are never included.
 */
export async function listMemberTrendsForStaff(input: {
  staffUserId: string;
  staffRole: string;
}): Promise<MemberTrend[]> {
  assertStaff(input.staffRole);
  const memberIds = await memberIdsVisibleToStaff(input.staffUserId, input.staffRole);
  if (memberIds.length === 0) {
    return [];
  }

  const members = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    include: {
      profile: true,
      workoutSessions: {
        select: { status: true, performedAt: true, updatedAt: true, difficultyRating: true },
      },
      lessonProgress: { select: { completed: true, completedAt: true } },
      chatThreads: {
        include: {
          messages: {
            where: { refused: true },
            select: { createdAt: true },
          },
        },
      },
      nutritionEntries: { select: { eatenAt: true } },
      helpRequests: { select: { status: true, createdAt: true, updatedAt: true } },
      sessions: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { email: "asc" },
  });

  return members.map((member) => {
    const workouts = member.workoutSessions.filter((row) => row.status === "complete");
    const difficulty = recentDifficultyAverage(workouts);
    const easyStreak = tooEasyStreak(workouts);
    const lessons = member.lessonProgress.filter((row) => row.completed);
    const handoffs = member.chatThreads.reduce(
      (sum, thread) => sum + thread.messages.length,
      0,
    );
    const timestamps: Date[] = [];
    for (const row of workouts) timestamps.push(row.performedAt);
    for (const row of member.nutritionEntries) timestamps.push(row.eatenAt);
    for (const row of lessons) {
      if (row.completedAt) timestamps.push(row.completedAt);
    }
    for (const thread of member.chatThreads) {
      for (const message of thread.messages) timestamps.push(message.createdAt);
    }
    if (member.sessions[0]) timestamps.push(member.sessions[0].createdAt);
    timestamps.sort((a, b) => b.getTime() - a.getTime());

    return {
      userId: member.id,
      email: member.email,
      displayName: member.profile?.displayName || member.email,
      workoutsLogged: workouts.length,
      lessonsCompleted: lessons.length,
      aiHandoffFlags: handoffs,
      lastActiveAt: timestamps[0]?.toISOString() ?? null,
      openHelpRequests: member.helpRequests.filter((row) => row.status === "open").length,
      recentDifficultyLabel: difficulty.label,
      tooEasyStreak: easyStreak,
      tooEasyNote: tooEasyCoachNote(easyStreak),
    };
  });
}

export async function assertCanViewMemberTrend(input: {
  staffUserId: string;
  staffRole: string;
  memberUserId: string;
}) {
  assertStaff(input.staffRole);
  if (input.staffRole === "admin") {
    return;
  }
  const assigned = await prisma.coachAssignment.findUnique({
    where: {
      coachUserId_memberUserId: {
        coachUserId: input.staffUserId,
        memberUserId: input.memberUserId,
      },
    },
  });
  if (!assigned) {
    throw new ForbiddenError("You can only see trends for members assigned to you.");
  }
}
