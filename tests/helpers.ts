import { prisma } from "@/lib/prisma";
import { registerAccount } from "@/lib/auth";

export async function resetDatabase() {
  await prisma.clipTimestampNote.deleteMany();
  await prisma.trainingClip.deleteMany();
  await prisma.challengeEnrollment.deleteMany();
  await prisma.svgChallenge.deleteMany();
  await prisma.groceryList.deleteMany();
  await prisma.weeklyFocusVideo.deleteMany();
  await prisma.pilotInvite.deleteMany();
  await prisma.hrWorkoutSession.deleteMany();
  await prisma.hrRestingSample.deleteMany();
  await prisma.polarConnection.deleteMany();
  await prisma.journalFeedback.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.weeklyCoachComment.deleteMany();
  await prisma.coachingAdjustment.deleteMany();
  await prisma.pathStepCompletion.deleteMany();
  await prisma.pathEnrollment.deleteMany();
  await prisma.progressPhoto.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.planWaitlist.deleteMany();
  await prisma.coachingCredit.deleteMany();
  await prisma.bodyPhotoPlaceholder.deleteMany();
  await prisma.bodyMetric.deleteMany();
  await prisma.metricEvent.deleteMany();
  await prisma.stripeEventLog.deleteMany();
  await prisma.helpRequest.deleteMany();
  await prisma.coachAssignment.deleteMany();
  await prisma.reminderPrefs.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.nutritionEntry.deleteMany();
  await prisma.savedMeal.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.workoutSet.deleteMany();
  await prisma.exerciseNote.deleteMany();
  await prisma.workoutSession.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

export async function makeUser(
  email: string,
  claimsGymMembership = false,
  role: "member" | "coach" | "admin" = "member",
) {
  const user = await registerAccount({
    email,
    password: "password12",
    displayName: email.split("@")[0],
    isAdultConfirmed: true,
    claimsGymMembership,
  });
  if (role !== "member") {
    await prisma.user.update({ where: { id: user.id }, data: { role } });
    return { ...user, role };
  }
  return { ...user, role: "member" as const };
}
