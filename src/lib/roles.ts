import { redirect } from "next/navigation";
import { ForbiddenError } from "@/lib/errors";
import type { PublicUser, UserRole } from "@/lib/auth";
import { requireUser, requireUserOrThrow } from "@/lib/session";

export function isAdmin(user: Pick<PublicUser, "role">) {
  return user.role === "admin";
}

export function isStaff(user: Pick<PublicUser, "role">) {
  return user.role === "admin" || user.role === "coach";
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isAdmin(user)) {
    redirect("/home");
  }
  return user;
}

export async function requireAdminOrThrow(): Promise<PublicUser> {
  const user = await requireUserOrThrow();
  if (!isAdmin(user)) {
    throw new ForbiddenError("Only an admin can do that.");
  }
  return user;
}

export async function requireStaff(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isStaff(user)) {
    redirect("/home");
  }
  return user;
}

export async function requireStaffOrThrow(): Promise<PublicUser> {
  const user = await requireUserOrThrow();
  if (!isStaff(user)) {
    throw new ForbiddenError("Only a coach or admin can do that.");
  }
  return user;
}

export function assertRole(user: PublicUser, role: UserRole) {
  if (user.role !== role) {
    throw new ForbiddenError("You do not have permission for that.");
  }
}
