import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { PaywallNotice } from "@/components/PaywallNotice";
import { getOrCreateThread, isOpenAiConfigured } from "@/lib/coach/chat";
import { getProfileForUser } from "@/lib/profile";
import { coachingToneNote } from "@/lib/onboarding";
import { CoachLiveThread } from "@/components/coach/CoachLiveThread";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import {
  COACH_ARTS,
  COACH_ART_LABELS,
  COACH_PUBLIC_NAME,
  COACH_TOPICS,
  COACH_TOPIC_BLURBS,
  COACH_TOPIC_LABELS,
  buildCoachHref,
  coachLaneLabel,
  resolveCoachArt,
  resolveCoachTopic,
} from "@/lib/coach/topics";

function TopicChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
        active
          ? "border-black bg-accent font-semibold text-black"
          : "border-line text-muted hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; art?: string }>;
}) {
  const user = await requireUser();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    return <PaywallNotice feature={COACH_PUBLIC_NAME} />;
  }
  const query = await searchParams;
  const topic = resolveCoachTopic(query.topic);
  const art = topic === "martial_art" ? resolveCoachArt(query.art) : undefined;
  const live = isOpenAiConfigured();
  const profile = await getProfileForUser(user.id);
  const toneCopy = coachingToneNote(profile?.coachingTone ?? "");
  const ready = Boolean(topic && (topic !== "martial_art" || art));
  const thread = ready
    ? await getOrCreateThread(user.id, { topic, art })
    : null;
  const lane = coachLaneLabel(topic, art);

  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          {live ? "Live model + safety rails" : "DEMO / offline mode"}
        </p>
        <h1 className="text-2xl font-semibold">{COACH_PUBLIC_NAME}</h1>
        <p className="mt-2 text-sm text-muted">
          An AI coaching assistant inspired by SVG (Sacrifice, Vision, Greatness).
          Not a live coach, not medical advice, and{" "}
          <strong className="text-foreground">not Ricky</strong> typing.
        </p>
        <AiDisclaimer className="mt-3 text-sm text-muted" />
        {toneCopy ? <p className="mt-3 text-sm text-muted">{toneCopy}</p> : null}
      </div>

      {!topic ? (
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-muted">Pick a topic</p>
          <ul className="space-y-3">
            {COACH_TOPICS.map((item) => (
              <li key={item}>
                <Link
                  href={buildCoachHref({ topic: item })}
                  className="block rounded-2xl border border-line bg-card px-5 py-5"
                >
                  <p className="font-display text-lg font-semibold uppercase tracking-wide">{COACH_TOPIC_LABELS[item]}</p>
                  <p className="mt-1 text-sm text-muted">{COACH_TOPIC_BLURBS[item]}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topic === "martial_art" && !art ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-muted">Pick an art</p>
            <Link href="/coach" className="text-sm text-muted hover:text-foreground">
              All topics
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {COACH_ARTS.map((item) => (
              <TopicChip key={item} href={buildCoachHref({ topic: "martial_art", art: item })}>
                {COACH_ART_LABELS[item]}
              </TopicChip>
            ))}
          </div>
        </section>
      ) : null}

      {ready && thread ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 items-center rounded-full bg-accent px-3 text-sm font-semibold text-black">
              {lane}
            </span>
            <Link href="/coach" className="text-sm text-muted hover:text-foreground">
              Change topic
            </Link>
          </div>

          <CoachLiveThread
            topic={topic!}
            art={art}
            lane={lane}
            initialMessages={thread.messages}
          />
        </>
      ) : null}

      <p className="text-sm">
        <Link href="/clips" className="text-muted hover:text-foreground">
          Timestamped training clips (Fighter Development+)
        </Link>
      </p>
    </main>
  );
}
