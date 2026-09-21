import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/auth";

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
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can verify gym membership.");
  }
  const target = await prisma.profile.findUnique({
    where: { userId: input.targetUserId },
  });
  if (!target) {
    throw new NotFoundError("That member profile was not found.");
  }
  return prisma.profile.update({
    where: { userId: input.targetUserId },
    data: { gymMembershipVerified: input.verified },
  });
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
