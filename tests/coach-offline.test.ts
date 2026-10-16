import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { offlineReply } from "@/lib/coach/offline";
import { classifyIntent, classifyQuestion } from "@/lib/coach/router";
import { weeksUntil } from "@/lib/coach/timeframe";

const banned = /COACHING_GUIDE|DEMO-seeds|\.md\b|Topic:|demo mode|offline mode|API key|OPENAI/i;

describe("offline SVG Coach voice", () => {
  it("answers missed classes with one matching reply, not lifting fragments", () => {
    const reply = offlineReply(
      "I skipped two classes. What should I do this week?",
      "beginner",
      "",
      "mental",
    );
    const missed = classifyQuestion("I skipped two classes. What should I do this week?", {
      topic: "mental",
    });
    expect(missed.primary).toBe("mindset");
    expect(missed.signals).toContain("missed");
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
    expect(classifyQuestion(question, { topic: "conditioning" }).primary).toBe("programming");
    const reply = offlineReply(question, "beginner", "", "conditioning");
    expect(reply).toMatch(/Soreness after honest work is normal/);
    expect(reply).toMatch(/Sleep is part of the training/);
    expect(reply).not.toMatch(/missed classes|punishment session/i);
    expect(reply).not.toMatch(/loads you can control/i);
    expect(reply).not.toMatch(banned);
  });

  it("answers a nerves question with mindset, not a miss or lift cue", () => {
    const question = "I get nerves the night before class.";
    expect(classifyQuestion(question, { topic: "mental" }).primary).toBe("mindset");
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

const GENERIC =
  "Stay practical and do the next session you already have planned. If you need eyes on a movement, ask a coach on the floor. I will not guess gym-specific policy from here.";

const OFFLINE_CASES: Array<{
  message: string;
  topic?: string;
  art?: string;
  marker: RegExp;
}> = [
  {
    message: "How do I get off the cage when someone has double underhooks?",
    topic: "martial_art",
    art: "mma",
    marker: /step|position|drill/i,
  },
  {
    message: "Are 12-6 elbows legal now?",
    topic: "martial_art",
    art: "mma",
    marker: /legal|illegal|foul/i,
  },
  {
    message: "Is it legal to grab the fence to stop a takedown?",
    topic: "martial_art",
    art: "cagework",
    marker: /commission|promotion/i,
  },
  {
    message: "How heavy should my RDLs be this week at 2 RIR?",
    topic: "conditioning",
    marker: /RIR|lbs|sets?/i,
  },
  {
    message: "What should I eat the night before a 7am session?",
    topic: "conditioning",
    marker: /protein|meal|hydrat/i,
  },
  {
    message: "How far out should I start my weight cut?",
    topic: "conditioning",
    marker: /protein|meal|hydrat/i,
  },
  {
    message: "I freeze up in sparring and stop throwing",
    topic: "mental",
    marker: /breath|routine|cue|plan/i,
  },
  {
    message: "How do I build a game plan against a wrestler?",
    topic: "martial_art",
    art: "mma",
    marker: /step|position|drill|breath|routine|cue|plan/i,
  },
  {
    message: "My elbow hurts when I throw hooks",
    topic: "martial_art",
    art: "boxing",
    marker: /stop|doctor|physio/i,
  },
];

describe("offline answers by question type", () => {
  it("never uses the canned generic line for a specific question", () => {
    for (const row of OFFLINE_CASES) {
      const reply = offlineReply(row.message, "beginner", "", row.topic, row.art);
      expect(reply, row.message).not.toBe(GENERIC);
      expect(reply, row.message).toMatch(row.marker);
      expect(reply, row.message).not.toMatch(banned);
    }
    const rules = offlineReply(
      "Is it legal to grab the fence to stop a takedown?",
      "beginner",
      "",
      "martial_art",
      "cagework",
    );
    expect(rules).toMatch(/legal|illegal|foul/i);
    expect(rules).toMatch(/commission|promotion/i);
  });

  it("answers the February CFC question as a camp, not a nerves line", () => {
    const message =
      "I will be fighting the winner of the CFC 8 main event in El Paso TX. What do you suggest I focus on rn considering I don't fight until February?";
    const now = new Date("2026-10-16T15:00:00Z");
    expect(classifyIntent(message, { topic: "conditioning" })).toBe("fight_camp");
    expect(weeksUntil(new Date("2027-02-01T12:00:00Z"), now)).toBeGreaterThanOrEqual(14);
    expect(weeksUntil(new Date("2027-02-01T12:00:00Z"), now)).toBeLessThanOrEqual(16);
    const reply = offlineReply(message, "intermediate", "tough", "conditioning", "mma", {
      coachName: "Ricky",
      coachingStyle: "tough",
      now,
      facts: {
        liftDays: ["Monday", "Wednesday"],
        bagDays: ["Monday", "Wednesday"],
        sparringDays: ["Saturday"],
      },
    });
    expect(reply).toMatch(/February/i);
    expect(reply).toMatch(/base/i);
    expect(reply).toMatch(/specific/i);
    expect(reply).toMatch(/peak|taper/i);
    expect(reply).toMatch(/fight week/i);
    expect(reply).toMatch(/\b1[4-6] weeks\b/);
    expect(reply).toMatch(/Monday/);
    expect(reply).toMatch(/Saturday/);
    expect(reply).toMatch(/wrestler or a striker/i);
    expect(reply).toMatch(/rewatch/i);
    expect(reply).not.toMatch(/Nerves mean you care/);
    expect(reply).not.toMatch(banned);
  });

  it("reserves the canned generic line for a general question with no lane", () => {
    expect(offlineReply("hi", "beginner")).toBe(GENERIC);
    expect(offlineReply("hi", "beginner", "", "martial_art", "mma")).not.toBe(GENERIC);
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/coach/offline.ts"),
      "utf8",
    );
    const calls = source
      .split("\n")
      .filter((line) => /genericReply\(/.test(line) && !/function genericReply/.test(line));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/general/);
    expect(calls[0]).toMatch(/!topic/);
  });
});
