import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LearnVideoLink } from "@/components/learn/LearnVideoLink";
import { SeminarLockedPreview } from "@/components/learn/SeminarLockedPreview";
import { isYoutubeFormUrl, isYoutubeWatchUrl } from "@/lib/form-videos";
import { canUseFeature } from "@/lib/entitlements";
import { assignPlanForPilot } from "@/lib/billing";
import {
  SEMINARS,
  buildLearnHubHref,
  clipById,
  learnSeminarIssues,
  listClips,
  listSeminars,
  resolveSeminarCategory,
  resolveSeminarTime,
  seminarDetailAccess,
  seminarLocked,
} from "@/lib/learn-seminars";
import { startTrialForUser } from "@/lib/trial";
import { makeUser, resetDatabase } from "./helpers";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) =>
    createElement("img", { alt: alt ?? "", src: src ?? "" }),
}));

function turnStripeOn() {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
  process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
  process.env.STRIPE_PRICE_GYM = "price_gym";
  process.env.STRIPE_PRICE_ELITE_NON = "price_elite_non";
}

function turnStripeOff() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_STANDALONE;
  delete process.env.STRIPE_PRICE_GYM;
  delete process.env.STRIPE_PRICE_ELITE_NON;
}

describe("learn seminar catalog", () => {
  it("passes integrity checks for all 69 seminars and 487 clips", () => {
    expect(learnSeminarIssues()).toEqual([]);
    expect(SEMINARS).toHaveLength(69);
    expect(SEMINARS.reduce((total, seminar) => total + seminar.clips.length, 0)).toBe(487);
    expect(SEMINARS.filter((seminar) => seminar.priority)).toHaveLength(35);
    const counts = Object.fromEntries(
      ["mma", "boxing", "muay-thai", "wrestling", "bjj", "judo", "fight-iq", "sc"].map((id) => [
        id,
        SEMINARS.filter((seminar) => seminar.category === id).length,
      ]),
    );
    expect(counts).toEqual({
      mma: 17,
      boxing: 6,
      "muay-thai": 13,
      wrestling: 6,
      bjj: 10,
      judo: 6,
      "fight-iq": 6,
      sc: 5,
    });
  });

  it("sorts Bangtao first and filters cage-wall, level, and search", () => {
    const sorted = listSeminars();
    const firstPlain = sorted.findIndex((seminar) => !seminar.priority);
    expect(sorted.slice(0, firstPlain).every((seminar) => seminar.priority)).toBe(true);
    expect(sorted.slice(firstPlain).every((seminar) => !seminar.priority)).toBe(true);

    const wall = listSeminars({ category: "mma", cage: true });
    expect(wall.length).toBeGreaterThan(0);
    expect(wall.every((seminar) => seminar.tags.includes("cage-wall"))).toBe(true);

    expect(resolveSeminarCategory("cagework")).toBe("all");
    expect(resolveSeminarCategory("judo")).toBe("judo");
    expect(listSeminars({ q: "teep" }).length).toBeGreaterThan(0);
    expect(listClips({ q: "fence" }).some((clip) => clip.technique.toLowerCase().includes("fence"))).toBe(
      true,
    );
  });

  it("resolves shareable clip and time links, and ignores unknown values", () => {
    const seminar = SEMINARS.find((item) => item.clips.length > 0);
    if (!seminar) throw new Error("expected a seminar with clips");
    const clip = seminar.clips[0];
    expect(clipById(seminar, clip.id)?.id).toBe(clip.id);
    expect(clipById(seminar, "missing-clip")).toBeNull();

    const unknown = seminarDetailAccess(seminar, { fullLibrary: true, clipId: "missing-clip" });
    expect(unknown.locked).toBe(false);
    if (!unknown.locked) expect(unknown.initialClipId).toBeNull();

    const ignored = seminarDetailAccess(seminar, { fullLibrary: true, t: "99999" });
    expect(ignored.locked).toBe(false);
    if (!ignored.locked) expect(ignored.initialSeconds).toBeNull();
    expect(resolveSeminarTime(seminar.durationSeconds, "99999")).toBeNull();
    expect(resolveSeminarTime(seminar.durationSeconds, "0")).toBe(0);

    const both = seminarDetailAccess(seminar, {
      fullLibrary: true,
      clipId: clip.id,
      t: "10",
    });
    expect(both.locked).toBe(false);
    if (!both.locked) {
      expect(both.initialClipId).toBe(clip.id);
      expect(both.initialSeconds).toBeNull();
      expect(both.watchUrl).toBe(clip.watchUrl);
    }

    expect(
      buildLearnHubHref({ cat: "muay-thai", level: "beginner", q: "teep", view: "clips" }),
    ).toBe("/learn?q=teep&cat=muay-thai&level=beginner&view=clips");
    expect(buildLearnHubHref({ cat: "mma", cage: true })).toBe("/learn?cat=mma&cage=1");
  });

  it("keeps embed URLs off the locked teaser and renders no iframe", () => {
    const seminar = SEMINARS.find((item) => item.level !== "beginner" && item.clips.length > 0);
    if (!seminar) throw new Error("expected a locked seminar with clips");
    const access = seminarDetailAccess(seminar, {
      fullLibrary: false,
      clipId: seminar.clips[0]?.id,
      t: "10",
    });
    expect(access.locked).toBe(true);
    expect(access.playback).toBeNull();
    const payload = JSON.stringify(access);
    expect(payload).not.toContain("youtube-nocookie.com/embed");
    expect(payload).not.toContain("watchUrl");
    if (access.locked) {
      expect(access.teaser.techniques).toEqual(seminar.clips.map((clip) => clip.technique));
      const html = renderToStaticMarkup(
        createElement(SeminarLockedPreview, { teaser: access.teaser }),
      );
      expect(html).not.toContain("youtube-nocookie.com/embed");
      expect(html).not.toContain("<iframe");
      expect(html).toContain(seminar.displayTitle);
      expect(html).toContain("Locked");
      for (const clip of seminar.clips) {
        expect(html).not.toContain(`t=${clip.startSeconds}s`);
      }
    }
  });

  it("links a normal lesson watch URL without treating it as a Train form clip", () => {
    const url = SEMINARS[0]?.url;
    if (!url) throw new Error("expected a seminar url");
    expect(isYoutubeWatchUrl(url)).toBe(true);
    expect(isYoutubeFormUrl(url)).toBe(false);
    const html = renderToStaticMarkup(createElement(LearnVideoLink, { url, pending: false }));
    expect(html).toContain("Watch on YouTube");
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain("Video pending coach review");

    const pending = renderToStaticMarkup(createElement(LearnVideoLink, { url, pending: true }));
    expect(pending).toContain("Video pending coach review");
    expect(pending).not.toContain("href=");
  });
});

describe("seminar plan gating", () => {
  beforeEach(async () => {
    turnStripeOff();
    await resetDatabase();
  });

  afterAll(() => {
    turnStripeOff();
  });

  it("keeps intermediate seminars and their clips locked on Member Access", async () => {
    turnStripeOn();
    const user = await makeUser("learn-member@example.com");
    const fullLibrary = await canUseFeature(user.id, "learn_full");
    // Nonmember after the trial: locked until Pro.
    expect(await canUseFeature(user.id, "learn_beginner")).toBe(false);
    expect(fullLibrary).toBe(false);

    const beginner = SEMINARS.find((seminar) => seminar.level === "beginner");
    const intermediate = SEMINARS.find(
      (seminar) => seminar.level === "intermediate" && seminar.clips.length > 0,
    );
    if (!beginner || !intermediate) throw new Error("expected beginner and intermediate seminars");
    expect(seminarLocked(beginner, { fullLibrary })).toBe(false);
    expect(seminarLocked(intermediate, { fullLibrary })).toBe(true);
    const clip = seminarDetailAccess(intermediate, {
      fullLibrary,
      clipId: intermediate.clips[0]?.id,
    });
    expect(clip.locked).toBe(true);
  });

  it("unlocks every seminar for Performance and for a trial", async () => {
    turnStripeOn();
    const admin = await makeUser("learn-admin@example.com", false, "admin");
    const performance = await makeUser("learn-performance@example.com");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: performance.id,
      plan: "performance",
    });
    expect(await canUseFeature(performance.id, "learn_full")).toBe(true);
    expect(SEMINARS.every((seminar) => !seminarLocked(seminar, { fullLibrary: true }))).toBe(true);

    turnStripeOff();
    const trial = await makeUser("learn-trial@example.com", true);
    await startTrialForUser(trial.id);
    expect(await canUseFeature(trial.id, "learn_full")).toBe(true);
    const advanced = SEMINARS.find((seminar) => seminar.level === "advanced");
    if (!advanced) throw new Error("expected an advanced seminar");
    expect(seminarLocked(advanced, { fullLibrary: await canUseFeature(trial.id, "learn_full") })).toBe(
      false,
    );
  });
});
