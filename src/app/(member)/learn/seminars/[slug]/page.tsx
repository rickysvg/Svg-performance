import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeminarChapters } from "@/components/learn/SeminarChapters";
import { SeminarLockedPreview } from "@/components/learn/SeminarLockedPreview";
import { SeminarPlayback, SeminarPlayer } from "@/components/learn/SeminarPlayer";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { PaywallNotice } from "@/components/PaywallNotice";
import { canUseFeature } from "@/lib/entitlements";
import {
  seminarDetailAccess,
  seminarForSlug,
  seminarLevelLabel,
} from "@/lib/learn-seminars";
import { requireUser } from "@/lib/session";
import { getTrialState } from "@/lib/trial";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seminar = seminarForSlug(slug);
  return { title: seminar?.displayTitle ?? "Seminar" };
}

export default async function SeminarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ clip?: string; t?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;
  const seminar = seminarForSlug(slug);
  if (!seminar) notFound();

  const [fullLibrary, beginnerLibrary, trial] = await Promise.all([
    canUseFeature(user.id, "learn_full"),
    canUseFeature(user.id, "learn_beginner"),
    getTrialState(user.id),
  ]);
  if (!fullLibrary && !beginnerLibrary) {
    return <PaywallNotice feature="Learn" />;
  }

  const access = seminarDetailAccess(seminar, {
    fullLibrary,
    clipId: query.clip,
    t: query.t,
  });

  return (
    <main className="space-y-6">
      <Link href="/learn" className="text-sm text-muted hover:text-foreground">
        Back to Learn
      </Link>

      {access.locked ? (
        <SeminarLockedPreview teaser={access.teaser}>
          <UpgradePreview
            kind="seminar"
            canStartTrial={trial.canStartTrial}
            trialDays={trial.trialLengthDays}
            next={`/learn/seminars/${seminar.slug}`}
          />
        </SeminarLockedPreview>
      ) : (
        <SeminarPlayback
          model={access.playback}
          initialClipId={access.initialClipId}
          initialSeconds={access.initialSeconds}
        >
          <div className="sticky top-0 z-30 -mx-4 bg-black md:top-14">
            <SeminarPlayer />
            <p className="px-4 py-2 text-xs text-white/80">
              <a
                href={seminar.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Hosted on YouTube
              </a>
            </p>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl leading-tight">{seminar.displayTitle}</h1>
            <ul className="space-y-3">
              {seminar.instructors.map((instructor) => (
                <li key={instructor.name}>
                  <p className="font-semibold">{instructor.name}</p>
                  <p className="text-sm text-muted">
                    {instructor.credential}{" "}
                    <a
                      href={instructor.credentialSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      source
                    </a>
                  </p>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-line px-2.5 py-1">
                {seminarLevelLabel(seminar.level)}
              </span>
              <span className="rounded-full border border-line px-2.5 py-1">
                {seminar.categoryLabel}
              </span>
              <span className="rounded-full border border-line px-2.5 py-1">{seminar.duration}</span>
              {seminar.clips.length > 0 ? (
                <span className="rounded-full border border-line px-2.5 py-1">
                  {seminar.clips.length} {seminar.clips.length === 1 ? "clip" : "clips"}
                </span>
              ) : null}
            </p>
            <p className="text-sm text-muted">
              Video by{" "}
              <a
                href={seminar.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {seminar.channel}
              </a>{" "}
              on YouTube
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-muted">What this covers</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {seminar.notes.map((note) => (
                <li key={note.text}>{note.text}</li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              Notes summarized by SVG from the video&apos;s description, chapters and captions.
            </p>
          </section>

          {seminar.clipsStatus === "pending_transcript" ? (
            <p className="text-sm text-muted">
              Technique timestamps for this seminar are coming soon.
            </p>
          ) : null}

          <SeminarChapters />

          <noscript>
            <a href={access.watchUrl} target="_blank" rel="noopener noreferrer">
              Watch on YouTube
            </a>
          </noscript>
        </SeminarPlayback>
      )}
    </main>
  );
}
