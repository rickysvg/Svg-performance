import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listProgressPhotosForUser, progressPhotoSrc } from "@/lib/progress-photos";
import { PhotoUploadForm } from "@/components/progress/PhotoUploadForm";
import { PhotoTimeline } from "@/components/progress/PhotoTimeline";
import { deleteProgressPhotoAction } from "@/app/actions/body-metrics";
import { EmptyState } from "@/components/EmptyState";

function photoDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function ProgressPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const photos = await listProgressPhotosForUser(user.id);
  const left = photos.find((photo) => photo.id === params.a);
  const right = photos.find((photo) => photo.id === params.b);
  const comparing = Boolean(left && right && left.id !== right.id);

  return (
    <main className="space-y-5">
      <div>
        <Link href="/progress" className="text-sm underline">
          Progress
        </Link>
        <h1 className="mt-2 text-3xl">Progress photos</h1>
        <p className="mt-1 text-sm text-muted">
          Private to you. Each photo keeps the date you set. Coaches cannot open these.
        </p>
      </div>

      {comparing && left && right ? (
        <section className="space-y-3" data-photo-compare>
          <h2 className="text-lg">Side by side</h2>
          <div className="grid grid-cols-2 gap-2">
            {[left, right].map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={progressPhotoSrc(photo.id)}
                  alt={photo.caption || `Progress photo ${photoDateLabel(photo.recordedAt)}`}
                  className="aspect-[3/4] w-full object-cover"
                />
                <figcaption className="px-2 py-2 text-sm font-semibold">
                  {photoDateLabel(photo.recordedAt)}
                  {photo.caption ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted">{photo.caption}</span>
                  ) : null}
                </figcaption>
                <form action={deleteProgressPhotoAction}>
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input type="hidden" name="next" value="/progress/photos" />
                  <button type="submit" className="min-h-11 w-full border-t border-line text-sm text-danger">
                    Delete
                  </button>
                </form>
              </figure>
            ))}
          </div>
          <Link href="/progress/photos" className="inline-flex min-h-11 items-center text-sm underline">
            Back to timeline
          </Link>
        </section>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState title="No photos yet">
          Upload a jpeg, png, or webp. 5 MB max. Only you can open it.
        </EmptyState>
      ) : (
        <PhotoTimeline
          photos={photos.map((photo) => ({
            id: photo.id,
            src: progressPhotoSrc(photo.id),
            dateLabel: photoDateLabel(photo.recordedAt),
            caption: photo.caption,
          }))}
        />
      )}

      <details
        className="rounded-2xl border border-line bg-card px-4 py-3"
        {...(photos.length === 0 ? { open: true } : {})}
      >
        <summary className="cursor-pointer font-semibold">Add a photo</summary>
        <PhotoUploadForm />
      </details>
    </main>
  );
}
