import { prisma } from "@/lib/prisma";
import { countDistinctActiveUsersSince } from "@/lib/metrics";
import { mondayOf } from "@/lib/home";

export async function getPilotDashboardCounts(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = mondayOf(now);
  const [
    signups,
    invited,
    joined,
    waiting,
    openBookings,
    weeklyActives,
    openHelp,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "member" } }),
    prisma.pilotInvite.count({ where: { status: "invited" } }),
    prisma.pilotInvite.count({ where: { status: "joined" } }),
    prisma.planWaitlist.count({ where: { status: "waiting" } }),
    prisma.bookingRequest.count({ where: { status: "open" } }),
    countDistinctActiveUsersSince(weekAgo),
    prisma.helpRequest.count({ where: { status: "open" } }),
  ]);
  return {
    signups,
    invited,
    joined,
    waiting,
    openBookings,
    weeklyActives,
    openHelp,
    weekStart,
  };
}

export async function getPilotQueues() {
  const weekStart = mondayOf(new Date());
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  const [journalWaiting, commentsWaiting, bookings, waitlist, clipsWaiting] =
    await Promise.all([
      prisma.journalEntry.findMany({
        where: { feedback: { none: {} } },
        include: { user: { select: { email: true, id: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.user.findMany({
        where: {
          role: "member",
          weeklyComments: { none: { weekStartKey } },
        },
        select: { id: true, email: true },
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
      prisma.bookingRequest.findMany({
        where: { status: { in: ["open", "seen"] } },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.planWaitlist.findMany({
        where: { status: "waiting" },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.trainingClip.findMany({
        where: { notes: { none: {} } },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);
  return {
    weekStartKey,
    journalWaiting,
    commentsWaiting,
    bookings,
    waitlist,
    clipsWaiting,
  };
}
