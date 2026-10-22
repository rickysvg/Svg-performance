import { requireAdmin } from "@/lib/roles";
import { AdminBack } from "@/components/admin/AdminChrome";
import { listFocusVideosForAdmin } from "@/lib/focus-videos";
import { FocusVideoForm } from "@/components/admin/FocusVideoForm";
import { memberFacingTitle } from "@/lib/member-copy";
import { timeZoneForUser } from "@/lib/profile";
import { formatZonedDate } from "@/lib/timezone";

export default async function AdminFocusPage() {
  const admin = await requireAdmin();
  const timeZone = await timeZoneForUser(admin.id);
  const videos = await listFocusVideosForAdmin();

  return (
    <main className="space-y-6">
      <div>
        <AdminBack />
        <h1 className="mt-2 text-2xl">Weekly focus video</h1>
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
              {memberFacingTitle(row.title)}
            </p>
            <p className="text-sm text-muted">
              week {formatZonedDate(row.weekStart, timeZone)} · {row.status}
              {row.videoUrl ? " · URL" : ""}
              {row.storedName ? " · uploaded file" : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
