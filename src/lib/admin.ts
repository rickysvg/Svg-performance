import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/auth";
import { recomputeMembership } from "@/lib/gymdesk/recompute";

export async function listUsersForAdmin() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      profile: true,
      subscriptions: { orderBy: { updatedAt: "desc" }, take: 1 },
      coachingCredits: true,
    },
  });
}

export async function setGymMembershipVerified(input: {
  adminUserId: string;
  targetUserId: string;
  verified: boolean;
  note?: string;
}) {
  return setGymMembershipOverride({
    adminUserId: input.adminUserId,
    targetUserId: input.targetUserId,
    override: input.verified ? "force_on" : "force_off",
    note: input.note ?? "admin verify",
  });
}

export async function setGymMembershipOverride(input: {
  adminUserId: string;
  targetUserId: string;
  override: "none" | "force_on" | "force_off";
  note: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can verify gym membership.");
  }
  const note = input.note.trim();
  if (note.length < 3) {
    throw new AppError("ADMIN", "Add a short note for this override.");
  }
  const target = await prisma.profile.findUnique({
    where: { userId: input.targetUserId },
  });
  if (!target) {
    throw new NotFoundError("That member profile was not found.");
  }
  await prisma.profile.update({
    where: { userId: input.targetUserId },
    data: {
      gymMembershipOverride: input.override,
      gymMembershipOverrideNote: note.slice(0, 400),
      gymMembershipOverrideBy: admin.id,
      gymMembershipSource: "admin",
    },
  });
  return recomputeMembership(input.targetUserId);
}

export async function promoteUserToAdmin(email: string) {
  return promoteUserToRole(email, "admin");
}

export async function promoteUserToRole(email: string, role: "admin" | "coach") {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user) {
    throw new AppError("ADMIN", "No account uses that email yet. Create the account first.");
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { role },
  });
}

export async function promoteBootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  if (!email) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user) {
    return null;
  }
  if (user.role === "admin") {
    return user;
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { role: "admin" },
  });
}
