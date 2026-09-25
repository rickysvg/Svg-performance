import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/session";
import {
  formatTimestamp,
  getTrainingClipForActor,
  trainingClipSrc,
} from "@/lib/clips";
import { TimestampNoteForm } from "@/components/clips/TimestampNoteForm";
import { isStaff } from "@/lib/roles";
import { markClipFeedbackSeenAction } from "@/app/actions/clips";
import { deleteTrainingClipAction } from "@/app/actions/clips";

export default async function ClipDetailPage({
  params,
}: {
  params: Promise<{ clipId: string }>;
}) {
  const user = await requireOnboardedUser();
  const { clipId } = await params;
  const clip = await getTrainingClipForActor(clipId, user);
  const staff = isStaff(user);
  const owner = clip.userId === user.id;
  if (owner && clip.notes.length > 0 && !clip.feedbackSeenAt) {
    await markClipFeedbackSeenAction(clip.id);
    redirect(`/clips/${clip.id}?celebrate=clip`);
  }

  return (
    <main className="space-y-6">
      <div>
        <Link href={staff && !owner ? "/admin/queues" : "/clips"} className="text-sm text-accent underline">
          Back
        </Link>
        <h1 className="mt-2 text-2xl">{clip.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {clip.user.email}. Private file. Not a live stream.
        </p>
        {clip.memberNote ? <p className="mt-2 text-sm">{clip.memberNote}</p> : null}
      </div>
      <video
        controls
        src={trainingClipSrc(clip.id)}
        className="w-full rounded-2xl border border-line bg-black"
      />
      <section className="space-y-3">
        <h2>Timestamped notes</h2>
        {clip.notes.length === 0 ? (
          <p className="text-sm text-muted">No coach notes yet.</p>
        ) : (
          <ol className="space-y-3">
            {clip.notes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-accent">
                  {formatTimestamp(note.seconds)}
                </p>
                <p className="mt-1 text-sm">{note.correction}</p>
                {note.drill ? (
                  <p className="mt-1 text-sm text-muted">Drill: {note.drill}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
      {staff ? <TimestampNoteForm clipId={clip.id} /> : null}
      {owner ? (
        <form action={deleteTrainingClipAction}>
          <input type="hidden" name="clipId" value={clip.id} />
          <button type="submit" className="text-sm text-accent underline">
            Delete clip
          </button>
        </form>
      ) : null}
    </main>
  );
}
