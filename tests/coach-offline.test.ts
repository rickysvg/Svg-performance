import { describe, expect, it } from "vitest";
import { offlineReply } from "@/lib/coach/offline";

const banned = /COACHING_GUIDE|DEMO-seeds|\.md\b|Topic:|demo mode|offline mode|API key|OPENAI/i;

describe("offline SVG Coach voice", () => {
  it("answers a missed session like a floor coach", () => {
    const reply = offlineReply(
      "I skipped two classes. What should I do this week?",
      "beginner",
      "",
      "mental",
    );
    expect(reply).toMatch(/next session|punishment/i);
    expect(reply).not.toMatch(banned);
    expect(reply).not.toMatch(/\bbouts?\b/i);
    expect(reply).not.toMatch(/Ricky wrote/i);
  });

  it("gives boxing cues without a topic label", () => {
    const reply = offlineReply("How do I throw a jab?", "beginner", "", "martial_art", "boxing");
    expect(reply).toMatch(/stance|guard|jab/i);
    expect(reply).not.toMatch(/Topic:|Martial art/i);
    expect(reply).not.toMatch(banned);
  });

  it("uses the exercise name and hold cue on a notepad question", () => {
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
    expect(reply).toMatch(/20–30 seconds|clean/i);
    expect(reply).not.toMatch(banned);
    expect(reply).not.toMatch(/\bbouts?\b/i);
  });

  it("applies encouraging tone without announcing it", () => {
    const reply = offlineReply("I skipped class yesterday.", "intermediate", "encouraging");
    expect(reply).toMatch(/Good — you asked/i);
    expect(reply).not.toMatch(/Preferred tone/i);
    expect(reply).not.toMatch(banned);
  });
});
