import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/auth";

export async function listPilotInvites() {
  return prisma.pilotInvite.findMany({
    include: { invitedBy: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPilotInvite(input: {
  adminUserId: string;
  email: string;
  note?: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can send pilot invites.");
  }
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new AppError("INVITE", "Enter a valid email to invite.");
  }
  const existing = await prisma.pilotInvite.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("INVITE", "That email is already on the invite list.");
  }
  const alreadyUser = await prisma.user.findUnique({ where: { email } });
  return prisma.pilotInvite.create({
    data: {
      email,
      invitedById: admin.id,
      note: (input.note ?? "").trim().slice(0, 200),
      status: alreadyUser ? "joined" : "invited",
      joinedAt: alreadyUser ? new Date() : null,
    },
  });
}

export async function markInviteJoined(email: string) {
  const normalized = normalizeEmail(email);
  const row = await prisma.pilotInvite.findUnique({ where: { email: normalized } });
  if (!row || row.status === "joined") {
    return row;
  }
  return prisma.pilotInvite.update({
    where: { id: row.id },
    data: { status: "joined", joinedAt: new Date() },
  });
}

export async function deletePilotInvite(adminUserId: string, inviteId: string) {
  const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can remove invites.");
  }
  return prisma.pilotInvite.delete({ where: { id: inviteId } });
}
