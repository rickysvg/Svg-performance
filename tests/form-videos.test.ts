import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDemoProgram } from "@/lib/programs";
import {
  DEMO_FORM_VIDEOS,
  isYoutubeFormUrl,
  lookupFormVideo,
  youtubeThumbSrcs,
  youtubeVideoId,
} from "@/lib/form-videos";

describe("DEMO form videos", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("gives every seeded DEMO exercise a YouTube URL or an explicit pending flag", async () => {
    const program = await getDemoProgram();
    const exercises = program.days.flatMap((day) => day.exercises);
    expect(exercises.length).toBeGreaterThanOrEqual(15);

    for (const exercise of exercises) {
      const catalog = DEMO_FORM_VIDEOS[exercise.name];
      expect(catalog, `missing catalog row for ${exercise.name}`).toBeTruthy();
      const hasUrl = Boolean(exercise.formVideoUrl);
      const pending = exercise.formVideoPending;
      expect(hasUrl || pending).toBe(true);
      if (pending) {
        expect(exercise.formVideoUrl).toBe("");
      } else {
        expect(isYoutubeFormUrl(exercise.formVideoUrl)).toBe(true);
        expect(exercise.formVideoUrl).not.toMatch(/\/shorts\//);
      }
    }
  });

  it("rejects shorts and non-YouTube URLs in the helper", () => {
    expect(isYoutubeFormUrl("https://www.youtube.com/watch?v=nfX7IFK9UNI")).toBe(true);
    expect(isYoutubeFormUrl("https://www.youtube.com/shorts/abc123xyz")).toBe(false);
    expect(isYoutubeFormUrl("https://example.com/watch?v=nfX7IFK9UNI")).toBe(false);
  });

  it("builds YouTube still URLs from a watch or youtu.be link", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=nfX7IFK9UNI")).toBe("nfX7IFK9UNI");
    expect(youtubeVideoId("https://youtu.be/nfX7IFK9UNI")).toBe("nfX7IFK9UNI");
    expect(youtubeVideoId("https://www.youtube.com/shorts/nfX7IFK9UNI")).toBeNull();
    expect(youtubeThumbSrcs("https://www.youtube.com/watch?v=nfX7IFK9UNI")[0]).toBe(
      "https://i.ytimg.com/vi/nfX7IFK9UNI/hqdefault.jpg",
    );
  });

  it("falls back to the catalog when a stored day row is still pending", () => {
    const goblet = lookupFormVideo("Goblet squat", [
      { name: "Goblet squat", formVideoUrl: "", formVideoPending: true },
    ]);
    expect(goblet.pending).toBe(false);
    expect(isYoutubeFormUrl(goblet.url)).toBe(true);

    const bound = lookupFormVideo("Lateral bound or side step-over");
    expect(bound.pending).toBe(true);
    expect(bound.url).toBe("");
  });
});
