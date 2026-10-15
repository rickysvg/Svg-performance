/** Client-safe playback types. This module must not import the seminar catalog. */

export type SeminarPlaybackClip = {
  id: string;
  technique: string;
  notes: string;
  startSeconds: number;
  endSeconds: number | null;
  watchUrl: string;
  embedUrl: string;
};

export type SeminarPlaybackChapter = {
  startSeconds: number;
  endSeconds: number;
  label: string;
  timestamp: string;
};

export type SeminarPlaybackModel = {
  slug: string;
  videoId: string;
  displayTitle: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  clips: SeminarPlaybackClip[];
  chapters: SeminarPlaybackChapter[];
};

export type LockedSeminarTeaser = {
  slug: string;
  displayTitle: string;
  thumbnailUrl: string;
  channel: string;
  channelUrl: string;
  categoryLabel: string;
  levelLabel: string;
  duration: string;
  instructors: { name: string; credential: string; credentialSource: string }[];
  notes: string[];
  /** Technique names only. No timestamps and no embed URLs. */
  techniques: string[];
  clipsStatus: "verified" | "pending_transcript" | "not_needed";
};

export function formatTimestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function embedSrcFor(
  model: Pick<SeminarPlaybackModel, "embedUrl" | "clips">,
  clipId: string | null,
  seconds: number | null,
) {
  const clip = clipId ? model.clips.find((item) => item.id === clipId) : undefined;
  if (clip) return clip.embedUrl;
  if (seconds == null) return model.embedUrl;
  const url = new URL(model.embedUrl);
  url.searchParams.set("start", String(seconds));
  return url.toString();
}
