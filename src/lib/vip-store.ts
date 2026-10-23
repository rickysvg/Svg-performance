import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { getProfileForUser } from "@/lib/profile";
import { getTrialState } from "@/lib/trial";
import { APP_TIMEZONE, mondayOfZoned } from "@/lib/timezone";
import { buildTrainingStreak, plannerPrefsFromProfile } from "@/lib/streaks";
import { loggedSetSome } from "@/lib/logged-work";
import { billingPlanFromStored, catalogPlanFromStored } from "@/lib/pro-annual-record";
import {
  buildVipCheckoutDraft,
  holdIsOpen,
  VIP_INTRO_CENTS,
  VIP_MONTHLY_CENTS,
  inferProPeriod,
  liveCoachingSub,
  loadPlateau,
  pickVipUpsell,
  planWaitlistOffers,
  proRenewalWindow,
  quoteVipPrice,
  sparringRatingDip,
  summarizeVipIntake,
  trialDayNumber,
  unusedSubscriptionCents,
  type UpsellEvent,
  type VipCheckoutDraft,
  type VipGrantRow,
  type VipIntakeSummary,
  type VipQuote,
  type VipSubRow,
  type VipUpsellCard,
  type VipUpsellSignals,
} from "@/lib/vip-coaching";

const DAY_MS = 24 * 60 * 60 * 1000;

function vipError(message: string) {
  return new AppError("VIP", message);
}

function weekStart(now: Date) {
  return mondayOfZoned(now, APP_TIMEZONE);
}

async function loadRows(now: Date) {
  const [subscriptions, grants, camps] = await Promise.all([
    prisma.subscription.findMany({
      select: {
        userId: true,
        plan: true,
        status: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    }),
    prisma.vipCheckoutGrant.findMany({
      select: { userId: true, createdAt: true, status: true },
    }),
    prisma.fightCamp.findMany({
      where: { status: "active" },
      select: { userId: true },
    }),
  ]);
  const summary = summarizeVipIntake({
    subscriptions: subscriptions as VipSubRow[],
    grants: grants as VipGrantRow[],
    campUserIds: camps.map((row) => row.userId),
    now,
    weekStart: weekStart(now),
  });
  return { subscriptions, grants, summary };
}

export async function loadVipIntake(now = new Date()): Promise<VipIntakeSummary> {
  const { summary } = await loadRows(now);
  return summary;
}

export async function syncVipHolds(now = new Date()) {
  const intake = await loadVipIntake(now);
  const waiters = await prisma.planWaitlist.findMany({
    where: { plan: "coaching", status: "waiting" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, createdAt: true, holdUntil: true },
  });
  const offers = planWaitlistOffers({
    openSeats: intake.openSeats,
    waiters,
    now,
  });
  for (const offer of offers) {
    await prisma.planWaitlist.update({
      where: { userId_plan: { userId: offer.userId, plan: "coaching" } },
      data: { holdUntil: offer.holdUntil, offeredAt: now },
    });
  }
  return offers;
}

async function activeVip(userId: string, now: Date) {
  const rows = await prisma.subscription.findMany({
    where: { userId, status: "active" },
    select: { userId: true, plan: true, status: true, currentPeriodEnd: true, createdAt: true },
  });
  return rows.some((row) => liveCoachingSub(row, now));
}

async function openGrant(userId: string) {
  return prisma.vipCheckoutGrant.findFirst({
    where: { userId, status: "open" },
    orderBy: { createdAt: "desc" },
  });
}

async function latestApplication(userId: string) {
  return prisma.vipApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function proUnusedCentsForUser(userId: string, now = new Date()) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (!sub?.currentPeriodEnd) return 0;
  if (sub.status !== "active") return 0;
  if (catalogPlanFromStored(sub) !== "performance") return 0;
  if (sub.currentPeriodEnd.getTime() <= now.getTime()) return 0;
  const remaining = sub.currentPeriodEnd.getTime() - now.getTime();
  const billedPlan = billingPlanFromStored(sub);
  const annual =
    billedPlan.includes("year") ||
    billedPlan.includes("annual") ||
    (Boolean(process.env.STRIPE_PRICE_PERFORMANCE_YEAR) &&
      sub.stripePriceId === process.env.STRIPE_PRICE_PERFORMANCE_YEAR) ||
    remaining > 40 * DAY_MS;
  const period = inferProPeriod({ periodEnd: sub.currentPeriodEnd, annual });
  return unusedSubscriptionCents({
    priceCents: period.priceCents,
    periodStart: period.periodStart,
    periodEnd: sub.currentPeriodEnd,
    now,
  });
}

export async function quoteVipForUser(userId: string, now = new Date()): Promise<VipQuote> {
  const profile = await getProfileForUser(userId);
  const proUnusedCents = await proUnusedCentsForUser(userId, now);
  return quoteVipPrice({
    academyMember: Boolean(profile?.gymMembershipVerified),
    proUnusedCents,
  });
}

export type VipPricingPhase = "apply" | "waitlist" | "pending" | "checkout" | "member";

export async function getVipPricingPhase(userId: string | null, now = new Date()): Promise<VipPricingPhase> {
  try {
    await syncVipHolds(now);
    const intake = await loadVipIntake(now);
    if (!userId) return intake.openSeats > 0 ? "apply" : "waitlist";
    if (await activeVip(userId, now)) return "member";
    const grant = await openGrant(userId);
    if (grant) return "checkout";
    const application = await latestApplication(userId);
    if (application?.status === "pending") return "pending";
    const hold = await prisma.planWaitlist.findUnique({
      where: { userId_plan: { userId, plan: "coaching" } },
      select: { holdUntil: true, status: true },
    });
    if (intake.openSeats > 0 || (hold?.status === "waiting" && holdIsOpen(hold.holdUntil, now))) {
      return "apply";
    }
    return "waitlist";
  } catch (error) {
    console.error("[vip] pricing phase failed", error);
    return "apply";
  }
}

export async function submitVipApplication(
  userId: string,
  input: {
    goals: string;
    experience: string;
    fightDate: string;
    injuries: string;
    availability: string;
  },
  now = new Date(),
) {
  if (await activeVip(userId, now)) {
    throw vipError("You're already on VIP Coaching.");
  }
  if (await openGrant(userId)) {
    throw vipError("Checkout is already unlocked.");
  }
  const pending = await prisma.vipApplication.findFirst({
    where: { userId, status: "pending" },
  });
  if (pending) throw vipError("Ricky already has your application.");
  await syncVipHolds(now);
  const intake = await loadVipIntake(now);
  const hold = await prisma.planWaitlist.findUnique({
    where: { userId_plan: { userId, plan: "coaching" } },
    select: { holdUntil: true, status: true },
  });
  const held = hold?.status === "waiting" && holdIsOpen(hold.holdUntil, now);
  if (intake.paused && !held) {
    throw vipError("Intake is paused. Join the waitlist. Limited spots.");
  }
  return prisma.vipApplication.create({
    data: { userId, ...input, status: "pending" },
  });
}

export async function reviewVipApplication(input: {
  applicationId: string;
  reviewerId: string;
  decision: "approved" | "declined";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const application = await prisma.vipApplication.findUnique({
    where: { id: input.applicationId },
  });
  if (!application || application.status !== "pending") {
    throw vipError("That application is already reviewed.");
  }
  if (input.decision === "declined") {
    return prisma.vipApplication.update({
      where: { id: application.id },
      data: { status: "declined", reviewerId: input.reviewerId, reviewedAt: now },
    });
  }
  if (await activeVip(application.userId, now)) {
    throw vipError("This athlete is already on VIP Coaching.");
  }
  const intake = await loadVipIntake(now);
  if (intake.paused) {
    throw vipError("Intake is paused. A cap is full, so checkout stays locked.");
  }
  const quote = await quoteVipForUser(application.userId, now);
  const [updated] = await prisma.$transaction([
    prisma.vipApplication.update({
      where: { id: application.id },
      data: { status: "approved", reviewerId: input.reviewerId, reviewedAt: now },
    }),
    prisma.vipCheckoutGrant.create({
      data: {
        userId: application.userId,
        applicationId: application.id,
        status: "open",
        introApplied: quote.intro,
        creditCents: quote.creditCents,
        uncappedCents: quote.uncappedUnusedCents,
      },
    }),
  ]);
  return updated;
}

export async function getVipCheckoutView(userId: string) {
  const grant = await openGrant(userId);
  if (!grant) return null;
  const quote: VipQuote = {
    firstMonthCents: grant.introApplied ? VIP_INTRO_CENTS : VIP_MONTHLY_CENTS - grant.creditCents,
    recurringCents: VIP_MONTHLY_CENTS,
    creditCents: grant.creditCents,
    uncappedUnusedCents: grant.uncappedCents,
    intro: grant.introApplied,
  };
  const draft: VipCheckoutDraft = buildVipCheckoutDraft({ userId, quote });
  return { grant, quote, draft };
}

export async function getVipDesk(now = new Date()) {
  await syncVipHolds(now);
  const intake = await loadVipIntake(now);
  const [pendingRows, reviewed, waitlist, roster] = await Promise.all([
    prisma.vipApplication.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
    }),
    prisma.vipApplication.count({ where: { status: { in: ["approved", "declined"] } } }),
    prisma.planWaitlist.findMany({
      where: { plan: "coaching", status: "waiting" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
    }),
    prisma.subscription.findMany({
      where: { status: "active" },
      select: {
        userId: true,
        plan: true,
        status: true,
        currentPeriodEnd: true,
        createdAt: true,
        user: { select: { email: true, profile: { select: { displayName: true } } } },
      },
    }),
  ]);
  const clients = roster.filter((row) => liveCoachingSub(row, now));
  return {
    ...intake,
    pending: pendingRows.length,
    reviewed,
    applications: pendingRows,
    waitlist,
    clients,
  };
}

async function upsellSignals(userId: string, now: Date): Promise<VipUpsellSignals> {
  const [vip, grant, pending, intake, hold, formCheck, camp, profile, sets, sessions, trial, ai, sparring, pro] =
    await Promise.all([
      activeVip(userId, now),
      openGrant(userId),
      prisma.vipApplication.findFirst({ where: { userId, status: "pending" }, select: { id: true } }),
      loadVipIntake(now),
      prisma.planWaitlist.findUnique({
        where: { userId_plan: { userId, plan: "coaching" } },
        select: { status: true, holdUntil: true },
      }),
      prisma.formCheck.findFirst({
        where: { userId },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
      }),
      prisma.fightCamp.findUnique({
        where: { userId },
        select: { status: true, fightDateKey: true, updatedAt: true },
      }),
      getProfileForUser(userId),
      prisma.workoutSet.findMany({
        where: {
          loadValue: { gt: 0 },
          session: {
            userId,
            status: "complete",
            performedAt: { gte: new Date(now.getTime() - 42 * DAY_MS) },
          },
        },
        select: {
          exerciseName: true,
          loadValue: true,
          session: { select: { performedAt: true } },
        },
      }),
      prisma.workoutSession.findMany({
        where: { userId, status: "complete", sets: loggedSetSome },
        select: { performedAt: true },
      }),
      getTrialState(userId, now),
      prisma.aiUsageEvent.aggregate({
        where: { userId, kind: "message", createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
        _sum: { units: true },
      }),
      prisma.outsideSessionLog.findMany({
        where: { userId, sessionRating: { not: null } },
        orderBy: { dateKey: "desc" },
        take: 2,
        select: { sessionRating: true },
      }),
      prisma.subscription.findFirst({
        where: { userId, status: "active" },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
  const streak = profile
    ? buildTrainingStreak({
        completedDates: sessions.map((row) => row.performedAt),
        prefs: plannerPrefsFromProfile(profile),
        now,
        timeZone: profile.timeZone || APP_TIMEZONE,
      }).current
    : 0;
  const sevenDayTrial = trial.trialActive && trial.trialLengthDays === 7 && Boolean(trial.trialStartedAt);
  const onWaitlist = hold?.status === "waiting";
  const held = onWaitlist && holdIsOpen(hold?.holdUntil, now);
  return {
    isVip: vip || Boolean(grant) || Boolean(pending),
    canApply: !vip && !grant && !pending && (intake.openSeats > 0 || held),
    onWaitlist: Boolean(onWaitlist),
    formCheckAt: formCheck?.submittedAt ?? null,
    fightDateSetAt:
      camp && camp.status === "active" && camp.fightDateKey ? camp.updatedAt : null,
    plateau: loadPlateau(
      sets.map((row) => ({
        name: row.exerciseName.trim().toLowerCase(),
        load: row.loadValue ?? 0,
        at: row.session.performedAt,
      })),
      now,
    ),
    streakDays: streak,
    trialActive: sevenDayTrial,
    trialDay:
      sevenDayTrial && trial.trialStartedAt ? trialDayNumber(trial.trialStartedAt, now) : null,
    proRenewal: Boolean(
      pro &&
        catalogPlanFromStored(pro) === "performance" &&
        proRenewalWindow(pro.currentPeriodEnd, now),
    ),
    aiMessages24h: ai._sum.units ?? 0,
    sparringDip: sparringRatingDip(sparring[0]?.sessionRating ?? null, sparring[1]?.sessionRating ?? null),
  };
}

export async function presentVipUpsell(userId: string, now = new Date()): Promise<VipUpsellCard | null> {
  const signals = await upsellSignals(userId, now);
  const rows = await prisma.vipUpsellEvent.findMany({
    where: { userId, createdAt: { gte: new Date(now.getTime() - 90 * DAY_MS) } },
    orderBy: { createdAt: "asc" },
    select: { trigger: true, action: true, createdAt: true },
  });
  const events: UpsellEvent[] = rows
    .filter((row) => row.action === "shown" || row.action === "dismissed")
    .map((row) => ({
      trigger: row.trigger,
      action: row.action as "shown" | "dismissed",
      at: row.createdAt,
    }));
  const card = pickVipUpsell({ signals, events, now });
  if (!card) return null;
  await prisma.vipUpsellEvent.create({
    data: { userId, trigger: card.trigger, action: "shown" },
  });
  return card;
}

export async function dismissVipUpsell(userId: string, trigger: string, now = new Date()) {
  if (!trigger) return;
  await prisma.vipUpsellEvent.create({
    data: { userId, trigger, action: "dismissed", createdAt: now },
  });
}
