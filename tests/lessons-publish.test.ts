import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { isYoutubeFormUrl } from "@/lib/form-videos";
import {
  DEMO_LESSON_VIDEOS,
  parseLessonKeyDetails,
  resolveLessonVideo,
} from "@/lib/lesson-videos";
import {
  getPublishedLessonBySlug,
  listPublishedLessons,
  resolveLearnLevelFilter,
  resolveLearnTopicFilter,
  setLessonStatus,
  validateLessonInput,
} from "@/lib/lessons";
import { makeUser, resetDatabase } from "./helpers";

describe("lesson publish visibility", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("hides drafts from members and shows them after publish", async () => {
    await makeUser("learner@example.com");
    const published = await listPublishedLessons();
    expect(published.some((lesson) => lesson.slug === "demo-stance-base")).toBe(true);
    expect(published.some((lesson) => lesson.slug === "demo-draft-only")).toBe(false);

    await expect(getPublishedLessonBySlug("demo-draft-only")).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const draft = await prisma.lesson.findUnique({
      where: { slug: "demo-draft-only" },
    });
    expect(draft).toBeTruthy();
    await setLessonStatus(draft!.id, "published");
    const after = await getPublishedLessonBySlug("demo-draft-only");
    expect(after.title).toContain("Draft only");
  });
});

describe("Learn level and martial-art filters", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("defaults browse to beginner and keeps Member Access on beginner", () => {
    expect(resolveLearnLevelFilter(undefined, true)).toBe("beginner");
    expect(resolveLearnLevelFilter("all", true)).toBeUndefined();
    expect(resolveLearnLevelFilter("intermediate", true)).toBe("intermediate");
    expect(resolveLearnLevelFilter("intermediate", false)).toBe("beginner");
    expect(resolveLearnTopicFilter("boxing")).toBe("boxing");
    expect(resolveLearnTopicFilter("stance")).toBeUndefined();
  });

  it("returns only the requested level and martial art", async () => {
    const beginner = await listPublishedLessons({ skillLevel: "beginner" });
    const intermediate = await listPublishedLessons({ skillLevel: "intermediate" });
    const boxing = await listPublishedLessons({ topic: "boxing" });
    const boxingBeginner = await listPublishedLessons({
      topic: "boxing",
      skillLevel: "beginner",
    });

    expect(beginner.length).toBeGreaterThan(intermediate.length);
    expect(beginner.every((lesson) => lesson.skillLevel === "beginner")).toBe(true);
    expect(intermediate.every((lesson) => lesson.skillLevel === "intermediate")).toBe(true);
    expect(intermediate.some((lesson) => lesson.slug === "demo-boxing-one-two")).toBe(true);
    expect(beginner.some((lesson) => lesson.slug === "demo-boxing-one-two")).toBe(false);
    expect(boxing.map((lesson) => lesson.slug).sort()).toEqual(
      ["demo-boxing-one-two", "demo-jab-cue"].sort(),
    );
    expect(boxingBeginner).toHaveLength(1);
    expect(boxingBeginner[0]?.slug).toBe("demo-jab-cue");
    expect(beginner.some((lesson) => lesson.slug === "demo-draft-only")).toBe(false);
  });

  it("seeds martial-art topics and YouTube or pending on every DEMO lesson", async () => {
    const arts = new Set(["mma", "muay-thai", "boxing", "wrestling", "jiu-jitsu", "cagework"]);
    const lessons = await prisma.lesson.findMany();
    expect(lessons.length).toBeGreaterThanOrEqual(9);

    for (const lesson of lessons) {
      expect(arts.has(lesson.topic), `${lesson.slug} topic ${lesson.topic}`).toBe(true);
      const catalog = DEMO_LESSON_VIDEOS[lesson.slug];
      expect(catalog, `missing catalog row for ${lesson.slug}`).toBeTruthy();
      const video = resolveLessonVideo(lesson);
      expect(video.pending || isYoutubeFormUrl(video.url)).toBe(true);
      if (video.pending) {
        expect(lesson.videoPending || !lesson.youtubeUrl).toBe(true);
      } else {
        expect(lesson.youtubeUrl).not.toMatch(/\/shorts\//);
        expect(parseLessonKeyDetails(lesson.keyDetails).length).toBeGreaterThan(0);
      }
    }
  });

  it("shows pending-video UX when a lesson has no approved YouTube link", () => {
    expect(resolveLessonVideo({ youtubeUrl: "", videoPending: true })).toEqual({
      url: "",
      pending: true,
    });
    expect(
      resolveLessonVideo({
        youtubeUrl: "https://www.youtube.com/shorts/abc123xyz",
        videoPending: false,
      }).pending,
    ).toBe(true);
    expect(
      resolveLessonVideo({
        youtubeUrl: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
        videoPending: false,
      }),
    ).toEqual({
      url: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
      pending: false,
    });
  });

  it("rejects a published-style lesson that has neither a YouTube link nor pending", () => {
    expect(() =>
      validateLessonInput({
        slug: "bad-video",
        title: "Missing video",
        summary: "Test",
        skillLevel: "beginner",
        topic: "mma",
        coachName: "SVG coaching staff",
        equipment: "",
        notes: "Notes",
        drills: "",
        keyDetails: "",
        youtubeUrl: "",
        videoPending: false,
        needsSupervision: false,
        supervisedNote: "",
        isDemo: true,
      }),
    ).toThrow(AppError);
  });
});
