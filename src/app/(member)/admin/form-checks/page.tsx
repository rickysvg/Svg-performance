import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import { formCheckStatusLabel, listFormChecksForReview } from "@/lib/form-check";
import { redirect } from "next/navigation";
import { AdminScreen } from "@/components/admin/AdminChrome";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { FormCheckReviewForm } from "@/components/form-check/FormCheckReviewForm";
import { deskSurfaceClass, queueItemTone } from "@/lib/admin-desk-status";

export default async function AdminFormChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser();
  if (!isFormCheckReviewer(user)) redirect("/home");
  const query = await searchParams;
  const rows = await listFormChecksForReview();
  const open = rows.filter((row) => row.status !== "reviewed");
  const reviewed = rows.filter((row) => row.status === "reviewed").reverse();
  const selected = query.id ? rows.find((row) => row.id === query.id) : null;

  if (query.id) {
    return (
      <AdminScreen
        backHref="/admin/form-checks"
        backLabel="Queue"
        kicker="Form check"
        title={selected?.movement ?? "Clip"}
        hint={selected ? undefined : "That clip is not in the queue."}
      >
        {selected ? <ClipReview row={selected} /> : null}
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      kicker="Priority"
      title="Form checks"
      hint={open.length > 0 ? `${open.length} waiting. Tap a clip, leave the note, mark it reviewed.` : "No clips waiting."}
    >
      <Queue rows={open} empty="Queue is clear." />
      {reviewed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Reviewed</h2>
          <Queue rows={reviewed} empty="" />
        </section>
      ) : null}
    </AdminScreen>
  );
}

function Queue({
  rows,
  empty,
}: {
  rows: Awaited<ReturnType<typeof listFormChecksForReview>>;
  empty: string;
}) {
  if (rows.length === 0) {
    return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const tone = queueItemTone(row.status === "reviewed");
        return (
          <li key={row.id}>
            <Link
              href={`/admin/form-checks?id=${row.id}`}
              data-desk-tone={tone}
              className={`hc-panel flex items-center justify-between gap-3 px-4 py-4 ${deskSurfaceClass(tone)}`}
            >
              <span>
                <span className="font-display block text-xl uppercase leading-tight tracking-wide">
                  {row.movement}
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {row.user.profile?.displayName || row.user.email}
                </span>
                <span className="mt-1 block font-telemetry text-[11px] uppercase tracking-[0.12em] text-white/60">
                  {row.submittedAt.toISOString().slice(0, 10)} · {row.durationSeconds}s ·{" "}
                  {formCheckStatusLabel(row.status)}
                </span>
              </span>
              <DeskBadge tone={tone} label={row.status === "reviewed" ? "Done" : row.status === "in_review" ? "Open" : "New"} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ClipReview({
  row,
}: {
  row: Awaited<ReturnType<typeof listFormChecksForReview>>[number];
}) {
  return (
    <article className="space-y-3">
      <p className="text-sm text-muted">
        {row.user.profile?.displayName || row.user.email} · {row.user.email}
      </p>
      {row.note ? <p className="text-sm">{row.note}</p> : null}
      <video
        controls
        playsInline
        preload="metadata"
        className="aspect-video max-h-[70dvh] w-full rounded-2xl bg-black"
        src={`/api/form-checks/${row.id}`}
      />
      <FormCheckReviewForm checkId={row.id} status={row.status} feedback={row.feedback} />
    </article>
  );
}
