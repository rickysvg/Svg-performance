import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  PASSWORD_RESET_MAX_PER_EMAIL,
  PASSWORD_RESET_MAX_PER_IP,
  PASSWORD_RESET_RATE_MESSAGE,
  PASSWORD_RESET_WINDOW_MS,
} from "@/lib/password-reset-policy";

function rateKey(scope: string, value: string): string {
  const pepper = process.env.AUTH_SECRET || "password-reset-rate";
  return createHash("sha256").update(`${pepper}:${scope}:${value}`).digest("hex");
}

export async function assertPasswordResetRateLimit(
  scope: "email" | "ip",
  value: string,
) {
  const keyHash = rateKey(scope, value.trim().toLowerCase());
  const since = new Date(Date.now() - PASSWORD_RESET_WINDOW_MS);
  const max = scope === "email" ? PASSWORD_RESET_MAX_PER_EMAIL : PASSWORD_RESET_MAX_PER_IP;

  await prisma.passwordResetAttempt.deleteMany({
    where: { createdAt: { lt: since } },
  });

  const count = await prisma.passwordResetAttempt.count({
    where: { keyHash, createdAt: { gte: since } },
  });
  if (count >= max) {
    throw new AppError("RATE", PASSWORD_RESET_RATE_MESSAGE, 429);
  }
  await prisma.passwordResetAttempt.create({ data: { keyHash } });
}
