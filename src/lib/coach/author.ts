import { resolveAiCoach, resolveAiCoachByName } from "@/lib/coaches";
import { prisma } from "@/lib/prisma";

/** Coach id stored on a reply so a later switch does not relabel it. */
export async function authoringCoachId(userId: string, coachName?: string | null) {
  const named = coachName?.trim();
  if (named) return resolveAiCoachByName(named).id;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { aiCoachId: true },
  });
  return resolveAiCoach(profile?.aiCoachId).id;
}
