import { describe, expect, it } from "vitest";
import { matchCoachIntent, offlineReply } from "@/lib/coach/offline";

const banned = /COACHING_GUIDE|DEMO-seeds|\.md\b|Topic:|demo mode|offline mode|API key|OPENAI/i;

describe("offline SVG Coach voice", () => {
  it("answers missed classes with one matching reply, not lifting fragments", () => {
    const reply = offlineReply(
      "I skipped two classes. What should I do this week?",
      "beginner",
      "",
      "mental",
    );
    expect(matchCoachIntent("I skipped two classes. What should I do this week?")).toBe("missed");
    expect(reply).toMatch(/Two missed classes doesn't erase your work/);
    expect(reply).toMatch(/punishment session/);
    expect(reply).toMatch(/next scheduled class/);
    expect(reply).toMatch(/Consistency beats catching up/);
    expect(reply).not.toMatch(/loads you can control|last two reps/i);
    expect(reply).not.toMatch(banned);
    expect(reply).not.toMatch(/\bbouts?\b/i);
  });

  it("answers a soreness question with recovery, not a miss or lift cue", () => {
    const question = "My legs are sore from yesterday. What should I do?";
    expect(matchCoachIntent(question)).toBe("soreness");
    const reply = offlineReply(question, "beginner", "", "conditioning");
    expect(reply).toMatch(/Soreness after honest work is normal/);
    expect(reply).toMatch(/Sleep is part of the training/);
    expect(reply).not.toMatch(/missed classes|punishment session/i);
    expect(reply).not.toMatch(/loads you can control/i);
    expect(reply).not.toMatch(banned);
  });

  it("answers a nerves question with mindset, not a miss or lift cue", () => {
    const question = "I get nerves the night before class.";
    expect(matchCoachIntent(question)).toBe("nerves");
    const reply = offlineReply(question, "beginner", "", "mental");
    expect(reply).toMatch(/Nerves mean you care/);
    expect(reply).toMatch(/Show up, do the work you planned/);
    expect(reply).not.toMatch(/missed classes|punishment session/i);
    expect(reply).not.toMatch(/loads you can control/i);
    expect(reply).not.toMatch(banned);
  });

  it("gives boxing cues without a topic label", () => {
    const reply = offlineReply("How do I throw a jab?", "beginner", "", "martial_art", "boxing");
    expect(reply).toMatch(/stance|guard|jab/i);
    expect(reply).not.toMatch(/Topic:|Martial art/i);
    expect(reply).not.toMatch(banned);
  });

  it("uses the exercise name once and does not repeat if you're new", () => {
    const reply = offlineReply(
      [
        "Exercise: Front plank.",
        "Log mode: timed. load_reps is reps + lbs.",
        "Planned work: 3 holds × 30–45 sec, 60s rest.",
        "Member note or question: How long should I hold this if I am new?",
        "Give one or two practical cues.",
      ].join(" "),
      "beginner",
      "",
      "conditioning",
    );
    expect(reply).toMatch(/Front plank/);
    expect(reply).toMatch(/hold/i);
    expect(reply).toMatch(/20–30 seconds/i);
    expect(reply.match(/if you're new/gi) ?? []).toHaveLength(1);
    expect(reply).not.toMatch(banned);
    expect(reply).not.toMatch(/\bbouts?\b/i);
  });
});
