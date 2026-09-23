/**
 * Curated YouTube technique-reference catalog for DEMO Learn lessons.
 * These are external education links, not SVG-produced coaching videos.
 */

import { isYoutubeFormUrl } from "@/lib/form-videos";
import { LEARN_CATALOG, type LearnCatalogEntry } from "@/lib/learn-catalog";

export type LessonVideoSeed = {
  url: string;
  pending: boolean;
  channel: string;
  title: string;
};

export const DEMO_LESSON_VIDEOS: Record<string, LessonVideoSeed> = Object.fromEntries(
  LEARN_CATALOG.map((entry) => [
    entry.slug,
    {
      url: entry.url,
      pending: entry.pending,
      channel: entry.channel,
      title: entry.youtubeTitle,
    },
  ]),
);

export function lessonVideoFieldsFor(slug: string): {
  youtubeUrl: string;
  videoPending: boolean;
} {
  const entry = DEMO_LESSON_VIDEOS[slug];
  if (!entry || entry.pending) {
    return { youtubeUrl: "", videoPending: true };
  }
  return { youtubeUrl: entry.url, videoPending: false };
}

export function resolveLessonVideo(lesson: {
  youtubeUrl: string;
  videoPending: boolean;
}): { url: string; pending: boolean } {
  if (lesson.videoPending || !lesson.youtubeUrl || !isYoutubeFormUrl(lesson.youtubeUrl)) {
    return { url: "", pending: true };
  }
  return { url: lesson.youtubeUrl, pending: false };
}

export function parseLessonKeyDetails(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export function catalogVideoForSlug(slug: string): LearnCatalogEntry | null {
  return LEARN_CATALOG.find((entry) => entry.slug === slug) ?? null;
}
