import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { listFocusVideosForAdmin } from "@/lib/focus-videos";
import { FocusVideoForm } from "@/components/admin/FocusVideoForm";
import { DemoBadge } from "@/components/DemoBadge";

export default async function AdminFocusPage() {
  await requireAdmin();
  const videos = await listFocusVideosForAdmin();

  return (
    <main className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-accent underline">
          Back to toolkit
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Weekly focus video</h1>
        <p className="mt-1 text-sm text-muted">
          Aim for 60–90 seconds. Published videos show on Today for Performance+. Drafts
          stay hidden. Not a live stream.
        </p>
      </div>
      <FocusVideoForm />
      <ul className="space-y-3">
        {videos.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-semibold">
              {row.title} {row.isDemo ? <DemoBadge className="ml-2" /> : null}
            </p>
            <p className="text-sm text-muted">
              week {row.weekStart.toLocaleDateString()} · {row.status}
              {row.videoUrl ? " · URL" : ""}
              {row.storedName ? " · uploaded file" : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
