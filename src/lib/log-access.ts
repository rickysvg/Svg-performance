import { getAppTier } from "@/lib/entitlements";
import { AppError } from "@/lib/errors";

/** Members whose trial ended unpaid cannot write logs. Staff still can. */
export async function assertLoggingOpen(user: { id: string; role: string }) {
  if (user.role === "admin" || user.role === "coach") return;
  const tier = await getAppTier(user.id);
  if (tier === "locked") {
    throw new AppError("PAYWALL", "Subscribe to keep training. Logging stays off until you subscribe.");
  }
}
