import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { toProfileRecord } from "@/lib/profile";
import { isCoachId, isCoachingStyle, resolveCoach, resolveCoachingStyle } from "@/lib/coaches";

export async function saveCoachChoiceForUser(
  userId: string,
  input: { coachId: string; coachingStyle: string },
) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) {
    throw new NotFoundError("Profile not found.");
  }
  const coachId = isCoachId(input.coachId) ? input.coachId : resolveCoach(input.coachId).id;
  const coachingStyle = isCoachingStyle(input.coachingStyle)
    ? input.coachingStyle
    : resolveCoachingStyle(input.coachingStyle).id;
  const row = await prisma.profile.update({
    where: { userId },
    data: {
      aiCoachId: coachId,
      coachingStyle,
      coachChoiceAt: new Date(),
    },
  });
  return toProfileRecord(row);
}

/** Keep the default coach and stop asking. Does not overwrite a saved choice. */
export async function dismissCoachPromptForUser(userId: string) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) {
    throw new NotFoundError("Profile not found.");
  }
  if (existing.coachChoiceAt) {
    return toProfileRecord(existing);
  }
  const row = await prisma.profile.update({
    where: { userId },
    data: { coachChoiceAt: new Date() },
  });
  return toProfileRecord(row);
}
