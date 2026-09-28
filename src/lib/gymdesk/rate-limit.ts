import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { rateKeyHash } from "@/lib/gymdesk/crypto";

export async function assertGymdeskRateLimit(input: {
  scope: string;
  value: string;
  windowMs: number;
  max: number;
  message: string;
}) {
  const keyHash = rateKeyHash(input.scope, input.value);
  const since = new Date(Date.now() - input.windowMs);
  await prisma.gymdeskRateLimit.deleteMany({ where: { createdAt: { lt: since } } });
  const count = await prisma.gymdeskRateLimit.count({
    where: { keyHash, createdAt: { gte: since } },
  });
  if (count >= input.max) {
    throw new AppError("RATE", input.message, 429);
  }
  await prisma.gymdeskRateLimit.create({ data: { keyHash } });
}
