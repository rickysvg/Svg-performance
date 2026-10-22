import Link from "next/link";
import { requireUser } from "@/lib/session";
import { freeCoachChatLabel, getCoachChatAccess } from "@/lib/coach-access";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { getTrialState } from "@/lib/trial";
import { aiRemainingLabel, getAiAllowance } from "@/lib/ai-usage";
import { getMemberCoachThread } from "@/lib/coach/chat";
import { CoachLiveThread } from "@/components/coach/CoachLiveThread";
import { CoachMessengerShell } from "@/components/coach/CoachMessengerShell";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { resolveAiCoach, resolveCoachingStyle } from "@/lib/coaches";
import { recentRecoveryCheckIn } from "@/lib/recovery-ease";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";

export default async function CoachPage() {
  const user = await requireUser();
  const coachChat = await getCoachChatAccess(user);
  const chatAllowed = coachChat.allowed;
  const profile = await getProfileForUser(user.id);
  const coach = resolveAiCoach(profile?.aiCoachId);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const recovery = await recentRecoveryCheckIn(user.id, new Date(), tz);
  if (!chatAllowed) {
    const trial = await getTrialState(user.id);
    return (
      <main data-coach-locked="1" className="space-y-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">{COACH_PUBLIC_NAME}</h1>
        {recovery ? (
          <RecoveryNotice
            coachName={recovery.name}
            coachImage={recovery.image}
            message={recovery.message}
          />
        ) : null}
        <UpgradePreview
          kind="coach"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/coach"
        />
      </main>
    );
  }
  const style = resolveCoachingStyle(profile?.coachingStyle);
  const thread = await getMemberCoachThread(user.id);
  const remainingLabel = aiRemainingLabel(await getAiAllowance(user.id));

  return (
    <CoachMessengerShell>
      <header
        data-coach-header
        className="flex shrink-0 items-center gap-2.5 border-b border-[#cbf805]/35 bg-[#0b0c0e] px-3 py-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coach.circle}
          alt=""
          width={512}
          height={512}
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-[#CBF805]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-display text-lg uppercase leading-none tracking-wide">
              {coach.name}
            </h1>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#CBF805]" aria-hidden />
            <span className="sr-only">Online</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-white/70">{style.label} style</p>
        </div>
        <Link
          href="/clips"
          className="shrink-0 rounded-full border border-[#cbf805]/50 px-2.5 py-1 text-[11px] font-medium text-[#CBF805]"
        >
          VIP Coaching
        </Link>
      </header>
      {coachChat.freeDaysLeft != null && coachChat.freeDaysLeft > 0 ? (
        <p
          data-free-coach-chat
          className="shrink-0 border-b border-white/10 bg-black px-3 py-1.5 text-[11px] font-medium text-[#CBF805]"
        >
          {freeCoachChatLabel(coachChat.freeDaysLeft)}. Counted from signup.
        </p>
      ) : null}
      {recovery ? (
        <div className="shrink-0 px-3 pt-2">
          <RecoveryNotice
            coachName={recovery.name}
            coachImage={recovery.image}
            message={recovery.message}
          />
        </div>
      ) : null}
      <CoachLiveThread
        threadId={thread.id}
        viewerRole={user.role}
        coachName={coach.name}
        coachId={coach.id}
        coachThumb={coach.thumb}
        timeZone={tz}
        remainingLabel={remainingLabel}
        initialMessages={thread.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          refused: message.refused,
          offline: message.offline,
          authorCoachId: message.coachId || undefined,
        }))}
      />
    </CoachMessengerShell>
  );
}
