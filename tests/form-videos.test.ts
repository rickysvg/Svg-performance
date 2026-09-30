import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { findSkillProgram, getDemoProgram } from "@/lib/programs";
import {
  DEMO_FORM_VIDEOS,
  FORM_VIDEO_SHORT_MAX_SECONDS,
  isYoutubeFormUrl,
  isYoutubeWatchUrl,
  lookupFormVideo,
  youtubeStartSeconds,
  youtubeThumbSrcs,
  youtubeVideoId,
} from "@/lib/form-videos";

describe("DEMO form videos", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("gives every seeded DEMO exercise a gym-floor YouTube URL or an explicit pending flag", async () => {
    const program = await getDemoProgram();
    const skill = await findSkillProgram();
    const exercises = [
      ...program.days.flatMap((day) => day.exercises),
      ...(skill?.days ?? []).flatMap((day) => day.exercises),
    ];
    expect(skill?.days.length).toBeGreaterThanOrEqual(6);
    expect(exercises.length).toBeGreaterThanOrEqual(40);

    for (const exercise of exercises) {
      const catalog = DEMO_FORM_VIDEOS[exercise.name];
      expect(catalog, `missing catalog row for ${exercise.name}`).toBeTruthy();
      const hasUrl = Boolean(exercise.formVideoUrl);
      const pending = exercise.formVideoPending;
      expect(hasUrl || pending).toBe(true);
      if (pending) {
        expect(exercise.formVideoUrl).toBe("");
      } else {
        expect(isYoutubeFormUrl(exercise.formVideoUrl), exercise.name).toBe(true);
        expect(exercise.formVideoUrl).toBe(catalog.url);
      }
    }
  });

  it("keeps every catalog form link short, a Short, or timestamped", () => {
    for (const [name, entry] of Object.entries(DEMO_FORM_VIDEOS)) {
      if (entry.pending) {
        expect(entry.url, name).toBe("");
        continue;
      }
      expect(isYoutubeFormUrl(entry.url), name).toBe(true);
      const shorts = /\/shorts\//.test(entry.url);
      const timed = youtubeStartSeconds(entry.url) !== null;
      const shortClip =
        typeof entry.seconds === "number" && entry.seconds <= FORM_VIDEO_SHORT_MAX_SECONDS;
      expect(shorts || timed || shortClip, name).toBe(true);
      if (!shorts && !timed) {
        expect(entry.seconds, name).toBeLessThanOrEqual(FORM_VIDEO_SHORT_MAX_SECONDS);
        expect(entry.seconds, name).toBeGreaterThan(0);
      }
    }
  });

  it("accepts Shorts and timestamped long-form, and rejects a long untimed watch URL", () => {
    expect(isYoutubeFormUrl("https://www.youtube.com/watch?v=nfX7IFK9UNI")).toBe(true);
    expect(isYoutubeFormUrl("https://www.youtube.com/shorts/1cVT3ee9mgU")).toBe(true);
    expect(isYoutubeFormUrl("https://www.youtube.com/watch?v=_oyxCn2iSjU")).toBe(false);
    expect(isYoutubeFormUrl("https://www.youtube.com/watch?v=_oyxCn2iSjU&t=45")).toBe(true);
    expect(isYoutubeFormUrl("https://youtu.be/_oyxCn2iSjU?t=1m30s")).toBe(true);
    expect(youtubeStartSeconds("https://youtu.be/_oyxCn2iSjU?t=1m30s")).toBe(90);
    expect(isYoutubeFormUrl("https://example.com/watch?v=nfX7IFK9UNI")).toBe(false);
    expect(isYoutubeFormUrl("https://example.com/shorts/1cVT3ee9mgU")).toBe(false);

    expect(isYoutubeWatchUrl("https://www.youtube.com/watch?v=_oyxCn2iSjU")).toBe(true);
    expect(isYoutubeWatchUrl("https://www.youtube.com/shorts/1cVT3ee9mgU")).toBe(false);
  });

  it("builds YouTube still URLs from a watch, youtu.be, or Shorts link", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=nfX7IFK9UNI")).toBe("nfX7IFK9UNI");
    expect(youtubeVideoId("https://youtu.be/nfX7IFK9UNI")).toBe("nfX7IFK9UNI");
    expect(youtubeVideoId("https://www.youtube.com/shorts/1cVT3ee9mgU")).toBe("1cVT3ee9mgU");
    expect(youtubeThumbSrcs("https://www.youtube.com/watch?v=nfX7IFK9UNI")[0]).toBe(
      "https://i.ytimg.com/vi/nfX7IFK9UNI/hqdefault.jpg",
    );
    expect(youtubeThumbSrcs("https://www.youtube.com/shorts/1cVT3ee9mgU")[0]).toBe(
      "https://i.ytimg.com/vi/1cVT3ee9mgU/hqdefault.jpg",
    );
  });

  it("falls back to the catalog when a stored day row is pending or a long untimed watch URL", () => {
    const goblet = lookupFormVideo("Goblet squat", [
      { name: "Goblet squat", formVideoUrl: "", formVideoPending: true },
    ]);
    expect(goblet.pending).toBe(false);
    expect(isYoutubeFormUrl(goblet.url)).toBe(true);
    expect(goblet.url).toMatch(/nfX7IFK9UNI/);

    const stale = lookupFormVideo("Goblet squat", [
      {
        name: "Goblet squat",
        formVideoUrl: "https://www.youtube.com/watch?v=_oyxCn2iSjU",
        formVideoPending: false,
      },
    ]);
    expect(stale.url).toMatch(/nfX7IFK9UNI/);
    expect(stale.pending).toBe(false);

    const neck = lookupFormVideo("Neck isometric matrix");
    expect(neck.pending).toBe(true);
    expect(neck.url).toBe("");
  });
});
