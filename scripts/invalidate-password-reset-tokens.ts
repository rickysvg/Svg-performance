import { prisma } from "../src/lib/prisma";
import { sweepLegacyPasswordResetTokens } from "../src/lib/auth";

sweepLegacyPasswordResetTokens(true)
  .then(async (count) => {
    console.log(
      `Invalidated ${count} password reset token(s) issued before the current fix.`,
    );
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
