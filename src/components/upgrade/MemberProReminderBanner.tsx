import Link from "next/link";
import type { AppTier } from "@/lib/entitlements";
import { memberProCopy, memberProRecap, memberProStage } from "@/lib/member-pro-reminders";
import { memberProDay, memberProGrantDays } from "@/lib/trial";
import { prisma } from "@/lib/prisma";

/** In-app reminder for the member Pro grant, using the length stored when it started. */
export async function MemberProReminderBanner({
  memberProStartedAt,
  memberProDays,
  tier,
  userId,
}: {
  memberProStartedAt: Date;
  memberProDays: number | null;
  tier: AppTier;
  userId?: string;
}) {
  const grantDays = memberProGrantDays(memberProDays);
  const day = memberProDay(memberProStartedAt);
  const stage = memberProStage(day, grantDays);
  if (!stage) return null;
  // Already paying for Pro after the free month: no reminder.
  if (stage === "day31" && tier === "pro") return null;
  if (!userId) return null;
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "active" },
    select: { id: true },
  });
  if (sub) return null;
  const recap = await memberProRecap(userId, memberProStartedAt);
  const daysLeft = day == null ? 0 : Math.max(0, grantDays - day);
  const copy = memberProCopy(stage, recap, daysLeft);
  return (
    <section
      data-member-pro-reminder={stage}
      className="mb-4 rounded-2xl border border-black bg-accent/20 p-4"
    >
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">SVG Pro</p>
      <h2 className="mt-1 text-lg text-black">{copy.title}</h2>
      <p className="mt-1 text-sm text-black">{copy.body}</p>
      <Link
        href="/pricing"
        className="touch-target mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent text-black"
      >
        {copy.cta}
      </Link>
    </section>
  );
}
