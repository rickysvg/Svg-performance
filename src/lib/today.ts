import { getHomeToday } from "@/lib/home";
import { getProfileForUser } from "@/lib/profile";
import { formatGoalDisplay } from "@/lib/onboarding";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planAtLeast, PLAN_CATALOG } from "@/lib/plans";
import { creditsForCurrentPlan } from "@/lib/credits";
import { listBookingRequestsForUser, bookingLabel } from "@/lib/bookings";
import { listHelpRequestsForMember } from "@/lib/help";
import {
  ensureDefaultPath,
  getPathBySlug,
  getPathProgress,
  recommendedLessonForUser,
  todayLane,
} from "@/lib/paths";
import { emptyHomeToday } from "@/lib/home";

export function todayPriorityCopy(lane: "beginner" | "fighter") {
  if (lane === "fighter") {
    return {
      headline: "Fighter priorities today",
      body: "Session first, then the skill. Use a credit or request for a human check-in — we do not invent a fight date or a Ricky comment.",
    };
  }
  return {
    headline: "Beginner priorities today",
    body: "Keep it simple: one DEMO session and one tutorial. A written goal beats a complicated plan.",
  };
}

export function emptyTodayGuide(selectedDay = new Date()) {
  const path = getPathBySlug("beginner-foundations");
  return {
    today: emptyHomeToday(selectedDay),
    lane: "beginner" as const,
    priority: todayPriorityCopy("beginner"),
    goal: "Add a goal on Profile so Today can show it.",
    hasGoal: false,
    path: {
      path: path!,
      enrollmentSlug: "beginner-foundations",
      doneKeys: [] as string[],
      nextStep: path?.steps[0] ?? null,
      completedCount: 0,
      totalSteps: path?.steps.length ?? 0,
      complete: false,
    },
    lesson: null,
    checkIn: {
      title: "No check-in on the calendar",
      body: "This app does not invent Ricky’s schedule. Request a time on Book when you want a human call.",
      href: "/book",
      kind: "empty" as const,
    },
    planLabel: PLAN_CATALOG.member_access.label,
    planId: "member_access" as const,
  };
}

export async function getTodayGuide(userId: string, selectedDay = new Date()) {
  const [today, profile, planId] = await Promise.all([
    getHomeToday(userId, selectedDay),
    getProfileForUser(userId),
    getEffectivePlanId(userId),
  ]);
  await ensureDefaultPath(userId);
  const [pathProgress, lesson, bookings, credits, help] = await Promise.all([
    getPathProgress(userId),
    recommendedLessonForUser(userId),
    listBookingRequestsForUser(userId),
    creditsForCurrentPlan(userId).then((row) => row.credits),
    listHelpRequestsForMember(userId),
  ]);
  const lane = todayLane(profile);
  const priority = todayPriorityCopy(lane);
  const goal = profile?.goals?.trim()
    ? profile.goals
    : profile?.goalKey
      ? formatGoalDisplay(profile.goalKey, "")
      : "";
  const openBooking = bookings.find((row) => row.status === "open" || row.status === "seen");
  const openHelp = help.find((row) => row.status === "open");
  const remainingCredits = credits.reduce((sum, row) => sum + row.remaining, 0);
  const showPlatinumStub = planAtLeast(planId, "platinum");

  let checkIn = {
    title: "No check-in on the calendar",
    body: "This app does not invent Ricky’s schedule. Request a time on Book when you want a human call.",
    href: "/book",
    kind: "empty" as "empty" | "credits" | "request" | "help" | "platinum",
  };
  if (openBooking) {
    checkIn = {
      title: `${bookingLabel(openBooking.kind)} · ${openBooking.status}`,
      body: openBooking.nextSteps
        ? `Agreed next steps: ${openBooking.nextSteps}`
        : `Preferred times on file: ${openBooking.preferredTimes}. Next steps stay empty until a coach writes them.`,
      href: "/book",
      kind: "request",
    };
  } else if (remainingCredits > 0) {
    checkIn = {
      title: `${remainingCredits} coaching credit${remainingCredits === 1 ? "" : "s"} left this month`,
      body: "Use Book with Ricky for mindset/strategy extras, or wait for a plan check-in. SVG Coach is not Ricky.",
      href: "/book",
      kind: "credits",
    };
  } else if (openHelp) {
    checkIn = {
      title: `Open coach help · ${openHelp.status}`,
      body: "A human request is already open. Status is open / seen / closed — not a 24/7 chat.",
      href: "/home",
      kind: "help",
    };
  } else if (showPlatinumStub) {
    checkIn = {
      title: "Platinum intensive stub",
      body: "Intensives are a request only. No live deposit or invented itinerary.",
      href: "/book",
      kind: "platinum",
    };
  }

  return {
    today,
    lane,
    priority,
    goal: goal || "Add a goal on Profile so Today can show it.",
    hasGoal: Boolean(goal),
    path: pathProgress,
    lesson,
    checkIn,
    planLabel: PLAN_CATALOG[planId].label,
    planId,
  };
}
