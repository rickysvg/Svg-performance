import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export const AI_CONSENT_REQUIRED =
  "Agree to the AI coach disclosure before SVG Coach can reply.";

export const AI_CONSENT_CODE = "ai_consent";

export async function hasAiCoachConsent(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { aiCoachConsentAt: true },
  });
  return Boolean(profile?.aiCoachConsentAt);
}

export async function assertAiCoachConsent(userId: string) {
  if (!(await hasAiCoachConsent(userId))) {
    throw new AppError("AI_CONSENT", AI_CONSENT_REQUIRED, 403);
  }
}

export async function setAiCoachConsent(userId: string, agreed: boolean) {
  await prisma.profile.update({
    where: { userId },
    data: { aiCoachConsentAt: agreed ? new Date() : null },
  });
}
