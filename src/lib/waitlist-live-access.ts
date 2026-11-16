import { isDashboardAdmin } from "@/lib/admin-access";
import { getCurrentUser } from "@/lib/session";
import type { PublicUser } from "@/lib/auth";

/**
 * Role admins and ADMIN_EMAILS. Same desk gate as the waitlist export.
 */
export async function requireWaitlistLiveAdmin(): Promise<
  | { ok: true; user: PublicUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }
  if (!isDashboardAdmin(user)) {
    return { ok: false, status: 403, error: "Only an admin can do that." };
  }
  return { ok: true, user };
}
