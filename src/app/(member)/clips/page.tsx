import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview } from "@/lib/plans";
import { listTrainingClipsForUser, formatTimestamp } from "@/lib/clips";
import { ClipUploadForm } from "@/components/clips/ClipUploadForm";
import { EmptyState } from "@/components/EmptyState";

export default async function ClipsPage() {
  const user = await requireOnboardedUser();
  const planId = await getEffectivePlanId(user.id);
  if (!planHasCoachReview(planId)) {
    return (
      <main className="space-y-4" data-clips-paywall="vip">
        <section className="rounded-2xl border border-accent/40 bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">VIP Coaching</p>
          <h1 className="mt-2 text-2xl">Timestamped video feedback</h1>
          <p className="mt-2 text-sm text-muted">
            This is on VIP Coaching. We do not fake a live stream.
          </p>
          <Link
            href="/vip/apply"
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-black"
          >
            Apply for VIP Coaching
          </Link>
        </section>
      </main>
    );
  }
  const clips = await listTrainingClipsForUser(user.id);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent">VIP Coaching</p>
        <h1 className="mt-2 text-2xl">Training clips</h1>
        <p className="mt-1 text-sm text-muted">
          Private uploads. An assigned coach can add mm:ss notes and a drill. Files stay
          on this server (S3 later — names only in README).
        </p>
      </div>
      <ClipUploadForm />
      {clips.length === 0 ? (
        <EmptyState title="No clips yet">Upload a short mp4 or webm of one skill.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {clips.map((clip) => (
            <li key={clip.id}>
              <Link
                data-testid={`clips-clip-${clip.id}`}
                href={`/clips/${clip.id}`}
                className="block rounded-2xl border border-line bg-card p-4 hover:border-accent"
              >
                <p className="font-semibold">{clip.title}</p>
                <p className="text-sm text-muted">
                  {clip.notes.length} note{clip.notes.length === 1 ? "" : "s"}
                  {clip.notes[0] ? ` · first at ${formatTimestamp(clip.notes[0].seconds)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
