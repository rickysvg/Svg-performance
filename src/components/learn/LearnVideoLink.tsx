import { isYoutubeWatchUrl } from "@/lib/form-videos";

export function LearnVideoLink({ url, pending }: { url: string; pending: boolean }) {
  if (pending || !url || !isYoutubeWatchUrl(url)) {
    return (
      <p className="mt-3 rounded-xl border border-line bg-background px-3 py-2 text-sm text-muted">
        Video pending coach review
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-black"
      >
        Watch on YouTube
      </a>
      <p className="text-xs text-muted">Hosted on YouTube</p>
    </div>
  );
}
