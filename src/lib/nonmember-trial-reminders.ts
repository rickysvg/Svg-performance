import { prisma } from "@/lib/prisma";
import { nonmemberTrialReminderStage } from "@/lib/checkout-trial";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { trialDaysLeft } from "@/lib/trial";
import { subscriptionGrantsAccess } from "@/lib/subscription-access";
import { performanceAppOrigin } from "@/lib/reminders";

export function nonmemberTrialReminderCopy(stage: "2d" | "1d") {
  const days = stage === "2d" ? "2 days" : "1 day";
  return {
    subject: `${days} left on your Pro trial`,
    text: `${days} left on your SVG Pro trial. No card is on file, and this trial does not renew. When it ends, history stays visible and training, logging, timers, the coach, and downloads lock until you subscribe. Pro is $9.99/mo or $72.99/yr. Open ${performanceAppOrigin()}/pricing`,
  };
}

export async function runNonmemberTrialReminderCron(now = new Date()) {
  if (!isSmtpConfigured()) return { checked: 0, sent: 0, skipped: 0, email: "not_configured" as const };
  const profiles = await prisma.profile.findMany({
    where: {
      gymMembershipVerified: false,
      memberProStartedAt: null,
      trialEndsAt: { gt: now },
    },
    select: {
      userId: true,
      trialEndsAt: true,
      user: { select: { email: true } },
    },
  });
  let sent = 0;
  let skipped = 0;
  for (const profile of profiles) {
    const stage = nonmemberTrialReminderStage(trialDaysLeft(profile.trialEndsAt, now));
    if (!stage) {
      skipped += 1;
      continue;
    }
    const sub = await prisma.subscription.findFirst({
      where: { userId: profile.userId },
      orderBy: { updatedAt: "desc" },
    });
    if (sub && subscriptionGrantsAccess(sub.status, sub.currentPeriodEnd, now)) {
      skipped += 1;
      continue;
    }
    const key = `nonmember_${stage}`;
    const already = await prisma.memberProReminderLog.findUnique({
      where: { userId_stage: { userId: profile.userId, stage: key } },
    });
    if (already) {
      skipped += 1;
      continue;
    }
    const copy = nonmemberTrialReminderCopy(stage);
    const mailed = await sendMail({ to: profile.user.email, subject: copy.subject, text: copy.text });
    if (!mailed.sent) {
      skipped += 1;
      continue;
    }
    await prisma.memberProReminderLog.create({
      data: { userId: profile.userId, stage: key, channel: "email" },
    });
    sent += 1;
  }
  return { checked: profiles.length, sent, skipped, email: "attempted" as const };
}
