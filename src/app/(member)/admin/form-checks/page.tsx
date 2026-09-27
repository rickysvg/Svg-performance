import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import { formCheckStatusLabel, listFormChecksForReview } from "@/lib/form-check";
import { FormCheckReviewForm } from "@/components/form-check/FormCheckReviewForm";

export default async function AdminFormChecksPage() {
  const user = await requireUser();
  if (!isFormCheckReviewer(user)) {
    redirect("/home");
  }
  const rows = await listFormChecksForReview();
  const open = rows.filter((row) => row.status !== "reviewed");
  const reviewed = rows.filter((row) => row.status === "reviewed").reverse();

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted">Admin</p>
        <h1 className="text-2xl">Form checks</h1>
        <p className="mt-2 text-sm text-muted">
          A real coach writes the note. Athletes see it signed SVG Coach. Clips stay private to
          the athlete and admins.
        </p>
      </div>
      <p className="text-sm">
        <Link href="/admin" className="font-semibold underline">
          Pilot toolkit
        </Link>
      </p>
      <Queue title="Waiting" rows={open} empty="No clips waiting." />
      <Queue title="Reviewed" rows={reviewed} empty="No reviewed clips yet." />
    </main>
  );
}

function Queue({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof listFormChecksForReview>>;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-[1.5rem] border border-line bg-card px-4 py-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-[1.5rem] border border-line bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg uppercase tracking-wide">{row.movement}</p>
                  <p className="mt-1 text-sm text-muted">
                    {row.user.profile?.displayName || row.user.email} · {row.user.email}
                  </p>
                  <p className="text-xs text-muted">
                    {row.submittedAt.toISOString().slice(0, 10)} · {row.durationSeconds}s ·{" "}
                    {formCheckStatusLabel(row.status)}
                  </p>
                </div>
              </div>
              {row.note ? <p className="mt-3 text-sm">{row.note}</p> : null}
              <video
                controls
                preload="metadata"
                className="mt-3 aspect-video w-full rounded-2xl bg-black"
                src={`/api/form-checks/${row.id}`}
              />
              <FormCheckReviewForm checkId={row.id} status={row.status} feedback={row.feedback} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
