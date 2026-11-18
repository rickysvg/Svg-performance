"use server";

import { AuthError, ForbiddenError } from "@/lib/errors";
import { requireWaitlistLiveAdmin } from "@/lib/waitlist-live-access";
import { runWaitlistLiveEmail } from "@/lib/waitlist-live-run";

/**
 * Same gate and dry-run default as POST /api/admin/waitlist/live.
 * Omit confirm for a count and preview. confirm "send" mails one batch.
 * confirm "test" needs `to` and does not stamp the list.
 */
export async function runWaitlistLiveEmailAction(input?: {
  confirm?: string;
  to?: string;
  firstName?: string;
}) {
  const gate = await requireWaitlistLiveAdmin();
  if (!gate.ok) {
    if (gate.status === 401) throw new AuthError(gate.error);
    throw new ForbiddenError(gate.error);
  }
  return runWaitlistLiveEmail({
    confirm: input?.confirm ?? null,
    to: input?.to ?? null,
    firstName: input?.firstName ?? null,
  });
}
