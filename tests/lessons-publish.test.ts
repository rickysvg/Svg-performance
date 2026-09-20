import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import {
  getPublishedLessonBySlug,
  listPublishedLessons,
  setLessonStatus,
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
