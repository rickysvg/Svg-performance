import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoachPicker } from "@/components/coach/CoachPicker";
import { CoachSpeakButton } from "@/components/coach/CoachSpeakButton";
import { TodaySummaryButton } from "@/components/home/TodaySummaryButton";
import { coachVoiceEnabled } from "@/lib/coach/config";
import { PRO_FAIR_USE_LINE } from "@/lib/pricing";
import { memberProCopy } from "@/lib/member-pro-reminders";

const synthesize = vi.fn();
vi.mock("@/lib/coach/tts", () => ({
  synthesizeCoachSpeech: (...args: unknown[]) => synthesize(...args),
}));

const loadSummary = vi.fn();
vi.mock("@/lib/coach/day-summary", () => ({
  getTodayCoachSummary: (...args: unknown[]) => loadSummary(...args),
}));

import { POST as speak } from "@/app/api/coach/speak/route";
import { GET as todaySummary } from "@/app/api/coach/today-summary/route";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("coach voice flag", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_COACH_VOICE;
    synthesize.mockClear();
    loadSummary.mockClear();
  });

  it("stays off unless NEXT_PUBLIC_COACH_VOICE is 1 or true", () => {
    delete process.env.NEXT_PUBLIC_COACH_VOICE;
    expect(coachVoiceEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_COACH_VOICE = "0";
    expect(coachVoiceEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_COACH_VOICE = "true";
    expect(coachVoiceEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_COACH_VOICE = "1";
    expect(coachVoiceEnabled()).toBe(true);
  });

  it("hides play, read-aloud, and voice samples while the coach picker stays", () => {
    delete process.env.NEXT_PUBLIC_COACH_VOICE;
    const speakHtml = renderToStaticMarkup(
      createElement(CoachSpeakButton, {
        text: "Hands home.",
        coachId: "ricky",
        audioRef: { current: null },
      }),
    );
    expect(speakHtml).toBe("");

    const home = renderToStaticMarkup(
      createElement(TodaySummaryButton, {
        name: "Ricky",
        circle: "/coaches/ricky-face.webp",
        coachId: "ricky",
      }),
    );
    expect(home).toContain("Today&#x27;s Summary");
    expect(home).not.toContain("<svg");

    const picker = renderToStaticMarkup(
      createElement(CoachPicker, { coachId: "skye", coachingStyle: "supportive" }),
    );
    expect(picker).toContain("Skye");
    expect(picker).toContain("Ricky");
    expect(picker).toContain("/coaches/skye.webp");
    expect(picker).not.toContain("<audio");
    expect(picker).not.toContain("sample");

    process.env.NEXT_PUBLIC_COACH_VOICE = "1";
    const on = renderToStaticMarkup(
      createElement(CoachSpeakButton, {
        text: "Hands home.",
        coachId: "ricky",
        audioRef: { current: null },
      }),
    );
    expect(on).toContain("data-coach-speak");
    expect(on).toContain("Play this reply");
  });

  it("does not call TTS routes while the flag is off", async () => {
    delete process.env.NEXT_PUBLIC_COACH_VOICE;
    const spoken = await speak(
      new Request("http://localhost/api/coach/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hands home." }),
      }),
    );
    expect(spoken.status).toBe(200);
    expect(await spoken.json()).toEqual({ speak: false, muted: true });
    expect(synthesize).not.toHaveBeenCalled();

    const summary = await todaySummary();
    expect(summary.status).toBe(200);
    expect(await summary.json()).toEqual({ speak: false, muted: true });
    expect(loadSummary).not.toHaveBeenCalled();
  });

  it("drops voice from the pricing, FAQ, and paywall selling copy", () => {
    expect(PRO_FAIR_USE_LINE).toBe("Fair use: 30 AI messages a day.");
    const surfaces = [
      "src/lib/pricing.ts",
      "src/app/pricing/page.tsx",
      "src/app/page.tsx",
      "src/components/upgrade/UpgradePreview.tsx",
      "src/lib/member-pro-reminders.ts",
    ];
    for (const file of surfaces) {
      const text = read(file);
      expect(text).not.toContain("AI coach chat with voices");
      expect(text).not.toContain("Today's Summary read-aloud");
      expect(text).not.toContain("read-aloud a day");
    }
    expect(read("src/app/pricing/page.tsx")).toContain("AI messages a day");
    expect(read("src/app/pricing/page.tsx")).not.toContain("minutes of voice");
    expect(read("src/components/upgrade/UpgradePreview.tsx")).toContain("30 AI messages a day");
    expect(read("src/components/upgrade/UpgradePreview.tsx")).not.toContain(
      "20 minutes of voice, and 1 read-aloud",
    );
    const recap = { workouts: 1, checkIns: 0, aiMessages: 0 };
    expect(memberProCopy("day29", recap).body).not.toMatch(/with voices|read-aloud/);
    expect(memberProCopy("day29", recap).body).toContain("AI coach chat");

    const speaker = read("src/components/coach/CoachSpeakButton.tsx");
    const reader = read("src/components/home/SummaryReader.tsx");
    expect(speaker.indexOf("if (!coachVoiceEnabled()) return null")).toBeLessThan(
      speaker.indexOf('fetch("/api/coach/speak"'),
    );
    expect(reader.indexOf("if (!coachVoiceEnabled()) return null")).toBeLessThan(
      reader.indexOf('fetch("/api/coach/today-summary"'),
    );
    expect(read("src/lib/coach/cue-prefetch.ts")).toContain("if (!coachVoiceEnabled()) return null");
  });
});
