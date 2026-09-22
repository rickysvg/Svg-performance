import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgressPhotoForUser, progressPhotoSrc } from "@/lib/progress-photos";
import { PhotoEditForm } from "@/components/progress/PhotoEditForm";
import { deleteProgressPhotoAction } from "@/app/actions/body-metrics";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export default async function ProgressPhotoPage({
  params,
}: {
  params: Promise<{ photoId: string }>;
}) {
  const user = await requireUser();
  const { photoId } = await params;
  let photo;
  try {
    photo = await getProgressPhotoForUser(photoId, user.id);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="space-y-6">
      <Link href="/progress" className="text-sm text-accent underline-offset-4 hover:underline">
        Back to My Progress
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Progress photo</h1>
        <p className="mt-1 text-sm text-muted">
          Private to you. Coaches and admins cannot open this in this preview.
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={progressPhotoSrc(photo.id)}
        alt={photo.caption || "Progress photo"}
        className="w-full rounded-2xl border border-line bg-card object-contain"
      />
      <p className="text-sm text-muted">
        Taken {photo.recordedAt.toLocaleDateString()} · uploaded{" "}
        {photo.createdAt.toLocaleDateString()}
      </p>
      <PhotoEditForm
        photoId={photo.id}
        caption={photo.caption}
        recordedAt={photo.recordedAt}
      />
      <form action={deleteProgressPhotoAction}>
        <input type="hidden" name="photoId" value={photo.id} />
        <button type="submit" className="touch-target text-sm text-danger underline">
          Delete this photo
        </button>
      </form>
    </main>
  );
}
