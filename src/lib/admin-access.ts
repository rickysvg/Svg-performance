import { redirect } from "next/navigation";
import { ForbiddenError } from "@/lib/errors";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import { requireUser, requireUserOrThrow } from "@/lib/session";
import type { PublicUser } from "@/lib/auth";

/** Role admins, plus any email listed in ADMIN_EMAILS. */
export function isDashboardAdmin(user: { role: string; email: string }) {
  return isFormCheckReviewer(user);
}

export async function requireDashboardAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isDashboardAdmin(user)) redirect("/home");
  return user;
}

export async function requireDashboardAdminOrThrow(): Promise<PublicUser> {
  const user = await requireUserOrThrow();
  if (!isDashboardAdmin(user)) {
    throw new ForbiddenError("Only an admin can do that.");
  }
  return user;
}
