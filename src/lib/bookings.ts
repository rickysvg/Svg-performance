import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { BOOKING_OFFERS, isBookingKind, type BookingKind } from "@/lib/plans";
import { getEffectivePlanId } from "@/lib/entitlements";
import { remainingCredit } from "@/lib/credits";
import { assertCanViewMemberTrend } from "@/lib/reports";

export const BOOKING_PREP: Record<BookingKind, string[]> = {
  mindset: [
    "Write one training or fight problem you want to talk through.",
    "Note what has been working and what has not this month.",
    "This is a request, not a confirmed calendar slot. SVG Coach is not Ricky.",
  ],
  entrepreneur: [
    "Bring one business or career question — no promised results.",
    "Separate gym training check-ins from this extra.",
    "List preferred times. We do not invent Ricky’s calendar.",
  ],
  intensive_elpaso: [
    "Read the Platinum package copy. This is a request stub, not a deposit.",
    "Travel to El Paso is on you unless quoted otherwise.",
    "Bring training history and one written goal. No invented itinerary until a coach writes next steps.",
  ],
  intensive_travel: [
    "Request stub only. Travel expenses are quoted separately.",
    "Do not treat this form as a booked intensive.",
    "After a coach writes next steps, they show on Book.",
  ],
};

export async function createBookingRequestForUser(
  userId: string,
  input: { kind: string; preferredTimes: string; note: string },
) {
  if (!isBookingKind(input.kind)) {
    throw new AppError("BOOKING", "Pick a valid booking type.");
  }
  const preferredTimes = input.preferredTimes.trim().slice(0, 400);
  if (!preferredTimes) {
    throw new AppError("BOOKING", "List a few preferred days or times. This is a request, not a confirmed calendar slot.");
  }
  const planId = await getEffectivePlanId(userId);
  let usesIncludedCredit = false;
  if (input.kind === "mindset" || input.kind === "entrepreneur") {
    const remaining = await remainingCredit(userId, "strategy_45");
    usesIncludedCredit = remaining > 0 && (planId === "vip" || planId === "platinum");
  }
  if (input.kind === "intensive_elpaso" || input.kind === "intensive_travel") {
    if (planId !== "platinum") {
      throw new AppError(
        "BOOKING",
        "Platinum intensives are a request stub for Platinum members. This is not a live deposit.",
      );
    }
  }
  return prisma.bookingRequest.create({
    data: {
      userId,
      kind: input.kind,
      preferredTimes,
      note: input.note.trim().slice(0, 400),
      usesIncludedCredit,
    },
  });
}

export async function listBookingRequestsForUser(userId: string) {
  return prisma.bookingRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listBookingRequestsForAdmin() {
  return prisma.bookingRequest.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function setBookingStatus(input: {
  adminUserId: string;
  requestId: string;
  status: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can update booking requests.");
  }
  if (!["open", "seen", "closed"].includes(input.status)) {
    throw new AppError("BOOKING", "Status must be open, seen, or closed.");
  }
  const row = await prisma.bookingRequest.findUnique({ where: { id: input.requestId } });
  if (!row) {
    throw new NotFoundError("Booking request not found.");
  }
  return prisma.bookingRequest.update({
    where: { id: input.requestId },
    data: { status: input.status },
  });
}

export function bookingLabel(kind: string) {
  if (kind in BOOKING_OFFERS) {
    return BOOKING_OFFERS[kind as keyof typeof BOOKING_OFFERS].label;
  }
  return kind;
}

export function bookingPrep(kind: string) {
  if (isBookingKind(kind)) {
    return BOOKING_PREP[kind];
  }
  return [];
}

export async function setBookingNextSteps(input: {
  staffUserId: string;
  staffRole: string;
  requestId: string;
  nextSteps: string;
}) {
  const row = await prisma.bookingRequest.findUnique({ where: { id: input.requestId } });
  if (!row) {
    throw new NotFoundError("Booking request not found.");
  }
  await assertCanViewMemberTrend({
    staffUserId: input.staffUserId,
    staffRole: input.staffRole,
    memberUserId: row.userId,
  });
  const nextSteps = input.nextSteps.trim().slice(0, 2000);
  return prisma.bookingRequest.update({
    where: { id: input.requestId },
    data: { nextSteps },
  });
}
