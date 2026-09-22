/**
 * Curated YouTube technique-reference catalog for DEMO Learn lessons.
 * These are external education links, not SVG-produced coaching videos.
 */

import { isYoutubeFormUrl } from "@/lib/form-videos";

export type LessonVideoSeed = {
  url: string;
  pending: boolean;
  channel: string;
  title: string;
};

export const DEMO_LESSON_VIDEOS: Record<string, LessonVideoSeed> = {
  "demo-stance-base": {
    url: "https://www.youtube.com/watch?v=NmqVOswRpW4",
    pending: false,
    channel: "Chess Club Jiu-Jitsu",
    title: "BJJ Beginners Tutorial - How to Sprawl",
  },
  "demo-jab-cue": {
    url: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
    pending: false,
    channel: "eBoxing Academy",
    title: "Beginner Boxing Tutorial: 6 Ways to Throw the Jab",
  },
  "demo-hip-escape": {
    url: "https://www.youtube.com/watch?v=TQ4gJ7E6Xis",
    pending: false,
    channel: "Stephan Kesting",
    title: "10 Ways to Shrimp and Improve Hip Mobility on the Ground",
  },
  "demo-teep-cue": {
    url: "https://www.youtube.com/watch?v=2nTKWDvZptk",
    pending: false,
    channel: "Kingdom Martial Arts Academy",
    title: "Learn the Muay Thai Teep in 11 minutes! Step-by-Step Tutorial for ALL Levels!",
  },
  "demo-double-leg": {
    url: "https://www.youtube.com/watch?v=KhEdji8BuQ0",
    pending: false,
    channel: "TeachMeGrappling Coach Brian",
    title: "How to PROPERLY Finish the DOUBLE LEG! (Drill)",
  },
  "demo-cage-clinch": {
    url: "https://www.youtube.com/watch?v=qMEXLKeMv_U",
    pending: false,
    channel: "Stuart Tomlinson / Greg Jackson",
    title: "MMA Training - Clinching against the Cage with Greg Jackson",
  },
  "demo-boxing-one-two": {
    url: "https://www.youtube.com/watch?v=D8DouKeOkfI",
    pending: false,
    channel: "Tony Jeffries",
    title: "How to Box 101 | Complete Boxing Tutorial for Beginners",
  },
  "demo-shrimp-frames": {
    url: "https://www.youtube.com/watch?v=4fyMiLey6rI",
    pending: false,
    channel: "Bernardo Faria BJJ Fanatics / Henry Akins",
    title: "Make Your Hip Escape (Shrimp) Unstoppable by Henry Akins",
  },
  "demo-cage-exit": {
    url: "",
    pending: true,
    channel: "",
    title: "",
  },
  "demo-draft-only": {
    url: "",
    pending: true,
    channel: "",
    title: "",
  },
};

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
