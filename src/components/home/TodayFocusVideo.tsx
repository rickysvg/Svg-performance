import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { embedUrlFor, focusVideoSrc } from "@/lib/focus-videos";
import type { getFocusVideoForMember } from "@/lib/focus-videos";

type Access = Awaited<ReturnType<typeof getFocusVideoForMember>>;

export function TodayFocusVideo({ access }: { access: Access }) {
  if (!access.unlocked) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-accent">Weekly focus</p>
        <h2 className="mt-1">60–90s SVG focus video</h2>
        <p className="mt-2 text-sm text-muted">
          Performance+ sees this week&apos;s published video on Today. Member Access gets
          this teaser only.
        </p>
        <Link href="/pricing" className="mt-2 inline-block text-sm text-accent underline">
          See TEST plans
        </Link>
      </section>
    );
  }
  if (!access.video) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-accent">Weekly focus</p>
        <h2 className="mt-1">No published video this week</h2>
        <p className="mt-2 text-sm text-muted">
          Admins schedule a 60–90s clip from the pilot toolkit. Drafts stay hidden.
        </p>
      </section>
    );
  }
  const embed = embedUrlFor(access.video.videoUrl);
  const fileSrc = access.video.storedName ? focusVideoSrc(access.video.id) : "";
  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Weekly SVG focus</p>
          <h2 className="mt-1 text-lg">{access.video.title}</h2>
        </div>
        {access.video.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        Labeled as an SVG / Ricky focus video when published. About 60–90 seconds. Not a
        live stream.
      </p>
      {embed ? (
        <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-line">
          <iframe
            title={access.video.title}
            src={embed}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : fileSrc ? (
        <video controls src={fileSrc} className="mt-3 w-full rounded-xl border border-line bg-black" />
      ) : null}
    </section>
  );
}
