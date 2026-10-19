import Link from "next/link";
import type { AppTier } from "@/lib/entitlements";
import { memberProCopy, memberProRecap, memberProStage } from "@/lib/member-pro-reminders";
import { memberProDay } from "@/lib/trial";
import { prisma } from "@/lib/prisma";

/** In-app reminder for the member Pro month: day 25, day 29, and day 31. */
export async function MemberProReminderBanner({
  memberProStartedAt,
  tier,
  userId,
}: {
  memberProStartedAt: Date;
  tier: AppTier;
  userId?: string;
}) {
  const stage = memberProStage(memberProDay(memberProStartedAt));
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
  const copy = memberProCopy(stage, recap);
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
