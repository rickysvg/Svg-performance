import Image from "next/image";
import type { ReactNode } from "react";
import type { LockedSeminarTeaser } from "@/lib/seminar-playback";

export function SeminarLockedPreview({
  teaser,
  children,
}: {
  teaser: LockedSeminarTeaser;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="relative -mx-4 aspect-video bg-black">
        <Image
          src={teaser.thumbnailUrl}
          alt={teaser.displayTitle}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          preload
        />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] text-highlighter">
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
            <rect
              x="3.5"
              y="7"
              width="9"
              height="6.5"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          Locked
        </span>
      </div>

      <div className="space-y-3">
        <h1 className="text-2xl leading-tight">{teaser.displayTitle}</h1>
        <ul className="space-y-3">
          {teaser.instructors.map((instructor) => (
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
          <span className="rounded-full border border-line px-2.5 py-1">{teaser.levelLabel}</span>
          <span className="rounded-full border border-line px-2.5 py-1">{teaser.categoryLabel}</span>
          <span className="rounded-full border border-line px-2.5 py-1">{teaser.duration}</span>
        </p>
        <p className="text-sm text-muted">
          Video by{" "}
          <a href={teaser.channelUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {teaser.channel}
          </a>{" "}
          on YouTube
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted">What this covers</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {teaser.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Notes summarized by SVG from the video&apos;s description, chapters and captions.
        </p>
      </section>

      {teaser.techniques.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Techniques</h2>
          <ul className="space-y-2 text-sm">
            {teaser.techniques.map((technique) => (
              <li key={technique} className="rounded-xl border border-line px-3 py-3">
                {technique}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {teaser.clipsStatus === "pending_transcript" ? (
        <p className="text-sm text-muted">Technique timestamps for this seminar are coming soon.</p>
      ) : null}

      {children}
    </div>
  );
}
