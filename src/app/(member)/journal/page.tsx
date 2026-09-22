import { requireUser } from "@/lib/session";
import { JOURNAL_KIND_LABELS, isJournalKind, listJournalEntriesForUser } from "@/lib/journal";
import { JournalForm } from "@/components/journal/JournalForm";
import { deleteJournalEntryAction } from "@/app/actions/journal";
import { EmptyState } from "@/components/EmptyState";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview } from "@/lib/plans";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [entries, planId] = await Promise.all([
    listJournalEntriesForUser(user.id, params.q ?? ""),
    getEffectivePlanId(user.id),
  ]);
  const coaching = planHasCoachReview(planId);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Coaching journal</h1>
        <p className="mt-1 text-sm text-muted">
          Goals, notes, questions, and lessons learned. Owner-only unless an assigned coach
          writes feedback
          {coaching ? " (your plan includes that slot)." : " — coaching tiers unlock coach replies."}
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search your entries"
          className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm"
        />
        <button
          type="submit"
          className="touch-target rounded-full border border-line px-4 text-sm"
        >
          Search
        </button>
      </form>

      <JournalForm />

      {entries.length === 0 ? (
        <EmptyState title="No entries yet">
          Write a goal or a question. We do not invent a coach reply.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-line bg-card p-5">
              <p className="text-xs uppercase text-muted">
                {isJournalKind(entry.kind) ? JOURNAL_KIND_LABELS[entry.kind] : entry.kind} ·{" "}
                {entry.createdAt.toLocaleString()}
              </p>
              <h2 className="mt-1 font-semibold">{entry.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>
              {entry.feedback.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  {entry.feedback.map((note) => (
                    <article key={note.id} className="text-sm">
                      <p className="text-xs uppercase text-muted">Coach feedback</p>
                      <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                      {note.actionItems ? (
                        <p className="mt-1 text-muted">Action items: {note.actionItems}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  No coach feedback yet. The slot stays empty until a human writes it.
                </p>
              )}
              <form action={deleteJournalEntryAction} className="mt-3">
                <input type="hidden" name="entryId" value={entry.id} />
                <button type="submit" className="text-xs text-danger underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
