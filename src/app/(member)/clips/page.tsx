import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview } from "@/lib/plans";
import { listTrainingClipsForUser, formatTimestamp } from "@/lib/clips";
import { ClipUploadForm } from "@/components/clips/ClipUploadForm";
import { EmptyState } from "@/components/EmptyState";
import { PaywallNotice } from "@/components/PaywallNotice";

export default async function ClipsPage() {
  const user = await requireOnboardedUser();
  const planId = await getEffectivePlanId(user.id);
  if (!planHasCoachReview(planId)) {
    return (
      <main className="space-y-4">
        <PaywallNotice feature="Timestamped video feedback" />
        <p className="text-sm text-muted">
          This is for Fighter Development and higher. We do not fake a live stream.
        </p>
      </main>
    );
  }
  const clips = await listTrainingClipsForUser(user.id);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl">Training clips</h1>
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
