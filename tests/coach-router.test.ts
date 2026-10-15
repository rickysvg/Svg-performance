import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { detectSafetyRefusal } from "@/lib/coach/safety";
import { classifyQuestion } from "@/lib/coach/router";
import { coachThreadHistory } from "@/lib/coach/llm";
import { runCoachChatStream } from "@/lib/coach/stream";
import { makeUser, resetDatabase } from "./helpers";
import { startTrialForUser } from "@/lib/trial";

const CAGE_Q = "When on cage can i use elbow against there jaw as a frame?";
const GENERIC =
  "Stay practical and do the next session you already have planned. If you need eyes on a movement, ask a coach on the floor. I will not guess gym-specific policy from here.";
const lane = { topic: "martial_art", art: "mma" };
const SECRET_KEY = "sk-test-do-not-log";
const REFERENCE = [
  "Short answer: Yes. Using your forearm or elbow as a frame against their jaw or face when you're on the cage is legal and smart, as long as you're pushing, not striking.",
  "Position: They've pinned you on the fence in the clinch, chest to chest, often with an underhook.",
  "Mechanics: 1. Win an underhook. 2. Slide your forearm across their jaw. 3. Push their head away. 4. Step your hips off the fence. 5. Keep your head tight.",
  "Common mistakes: Straight-arming the frame. Framing on the chest. An open palm toward their eyes. Grabbing the fence.",
  "Drill: Partner pins you on the wall. 5 rounds of frame, turn the head, angle off.",
  "Rules check: Framing and pushing aren't strikes and are legal. Most amateur rule sets ban elbows. 12-6 elbows were removed as an ABC foul in 2024. Check your commission.",
].join("\n\n");

const INCIDENT_MARKERS = [
  /frame|framing/i,
  /forearm|elbow/i,
  /jaw|chin|face/i,
  /cage|fence/i,
  /legal/i,
  /strike|strik/i,
  /12[- ]?(to[- ])?6/i,
  /amateur/i,
  /commission|promotion/i,
];

function sseResponse(text: string) {
  const body = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function makeCoachUser(email: string) {
  const user = await makeUser(email);
  await startTrialForUser(user.id);
  return user;
}

describe("question router", () => {
  it("classifies the cage-frame incident as technique plus rules", () => {
    const route = classifyQuestion(CAGE_Q, lane);
    expect(route.primary).toBe("technique");
    expect(route.secondary).toContain("rules");
    expect(route.signals).toEqual(expect.arrayContaining(["cage", "elbow", "frame", "can i use"]));
  });

  it.each([
    ["How do I get off the cage when someone has double underhooks?", { topic: "martial_art", art: "mma" }, "technique"],
    ["Are 12-6 elbows legal now?", { topic: "martial_art", art: "mma" }, "rules"],
    ["Is it legal to grab the fence to stop a takedown?", { topic: "martial_art", art: "cagework" }, "rules"],
    ["How heavy should my RDLs be this week at 2 RIR?", { topic: "conditioning" }, "programming"],
    ["What should I eat the night before a 7am session?", { topic: "conditioning" }, "nutrition"],
    ["How far out should I start my weight cut?", { topic: "conditioning" }, "nutrition"],
    ["I freeze up in sparring and stop throwing", { topic: "mental" }, "mindset"],
    ["My elbow hurts when I throw hooks", { topic: "martial_art", art: "boxing" }, "injury"],
    ["hi", {}, "general"],
    ["hi", { topic: "martial_art", art: "mma" }, "technique"],
  ] as const)("routes %j to %s", (message, rowLane, primary) => {
    expect(classifyQuestion(message, rowLane).primary).toBe(primary);
  });

  it("routes a game plan to fight IQ, not mindset", () => {
    const route = classifyQuestion("How do I build a game plan against a wrestler?", lane);
    expect(route.primary).toBe("fight_iq");
    expect(route.primary).not.toBe("mindset");
  });

  it("lets a rules question keep a technique note", () => {
    const elbows = classifyQuestion("Are 12-6 elbows legal now?", lane);
    expect(elbows.primary).toBe("rules");
    expect(elbows.secondary).toContain("technique");
  });

  it("does not route hard safety stops", () => {
    expect(detectSafetyRefusal("I think I have a concussion")?.code).toBe("pain");
    expect(detectSafetyRefusal("Help me cut weight with a sauna suit")?.code).toBe("weight_cut");
    expect(detectSafetyRefusal("How far out should I start my weight cut?")).toBeNull();
  });

  it("keeps the last 8 non-refused messages and caps each one", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `${index}-${"x".repeat(1600)}`,
      refused: index === 3,
    }));
    const history = coachThreadHistory(messages);
    expect(history).toHaveLength(8);
    expect(history[0]?.content.startsWith("4-")).toBe(true);
    expect(history.every((row) => row.content.length === 1500)).toBe(true);
    expect(history.some((row) => row.content.startsWith("3-"))).toBe(false);
  });
});

describe("coach live and offline paths", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  const previousTimeout = process.env.COACH_LLM_TIMEOUT_MS;
  const previousDelay = process.env.COACH_STREAM_DELAY_MS;

  beforeEach(async () => {
    await resetDatabase();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.COACH_LLM_TIMEOUT_MS;
    process.env.COACH_STREAM_DELAY_MS = "0";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
    if (previousTimeout === undefined) delete process.env.COACH_LLM_TIMEOUT_MS;
    else process.env.COACH_LLM_TIMEOUT_MS = previousTimeout;
    if (previousDelay === undefined) delete process.env.COACH_STREAM_DELAY_MS;
    else process.env.COACH_STREAM_DELAY_MS = previousDelay;
    await prisma.$disconnect();
  });

  it("calls OpenAI for the incident question when a key is set", async () => {
    process.env.OPENAI_API_KEY = SECRET_KEY;
    let requestBody = "";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return sseResponse(REFERENCE);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = await makeCoachUser("cage-live@example.com");
    const result = await runCoachChatStream({
      user,
      body: { kind: "chat", message: CAGE_Q, topic: "martial_art", art: "mma", experienceLevel: "beginner" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.offline).toBe(false);
    expect(result.content).toBe(REFERENCE);
    expect(result.content).not.toBe(GENERIC);
    const payload = JSON.parse(requestBody) as {
      messages: { role: string; content: string }[];
    };
    const system = payload.messages.find((row) => row.role === "system")?.content ?? "";
    expect(system).toMatch(/Position/);
    expect(system).toMatch(/Mechanics/);
    expect(system).toMatch(/Common mistakes/);
    expect(system).toMatch(/Drill/);
    expect(system).toMatch(/Rules check/);
    expect(system).toMatch(/check your commission/i);
    expect(system).toMatch(/MMA/);
    expect(system).not.toMatch(/Give one or two technical cues/);
    expect(payload.messages.at(-1)).toMatchObject({ role: "user", content: CAGE_Q });
  });

  it("answers the incident question offline without the canned line when the key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = await makeCoachUser("cage-offline@example.com");
    const result = await runCoachChatStream({
      user,
      body: { kind: "chat", message: CAGE_Q, topic: "martial_art", art: "mma" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.offline).toBe(true);
    expect(result.fallbackReason).toBe("no_key");
    expect(result.content).not.toBe(GENERIC);
    for (const marker of INCIDENT_MARKERS) {
      expect(result.content).toMatch(marker);
    }
  });

  it.each([
    ["http_429", 429],
    ["http_401", 401],
  ] as const)("logs %s and still answers the technique", async (reason, status) => {
    process.env.OPENAI_API_KEY = SECRET_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status })));
    const user = await makeCoachUser(`cage-${status}@example.com`);
    const result = await runCoachChatStream({
      user,
      body: { kind: "chat", message: CAGE_Q, topic: "martial_art", art: "mma" },
    });
    expect(result.offline).toBe(true);
    expect(result.fallbackReason).toBe(reason);
    expect(result.content).not.toBe(GENERIC);
    for (const marker of INCIDENT_MARKERS) {
      expect(result.content).toMatch(marker);
    }
    expect(warn).toHaveBeenCalledWith(
      "[coach] live model unavailable",
      expect.objectContaining({ reason, status }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET_KEY);
  });

  it("logs a network failure without the key", async () => {
    process.env.OPENAI_API_KEY = SECRET_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const user = await makeCoachUser("cage-network@example.com");
    const result = await runCoachChatStream({
      user,
      body: { kind: "chat", message: CAGE_Q, topic: "martial_art", art: "mma" },
    });
    expect(result.fallbackReason).toBe("network");
    expect(result.content).not.toBe(GENERIC);
    expect(warn).toHaveBeenCalledWith(
      "[coach] live model unavailable",
      expect.objectContaining({ reason: "network" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET_KEY);
  });

  it("times out a hung OpenAI call", async () => {
    process.env.OPENAI_API_KEY = SECRET_KEY;
    process.env.COACH_LLM_TIMEOUT_MS = "50";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          const onAbort = () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          if (signal?.aborted) onAbort();
          else signal?.addEventListener("abort", onAbort, { once: true });
        });
      }),
    );
    const user = await makeCoachUser("cage-timeout@example.com");
    const result = await runCoachChatStream({
      user,
      body: { kind: "chat", message: CAGE_Q, topic: "martial_art", art: "mma" },
    });
    expect(result.fallbackReason).toBe("timeout");
    expect(result.offline).toBe(true);
    expect(result.content).not.toBe(GENERIC);
    expect(warn).toHaveBeenCalledWith(
      "[coach] live model unavailable",
      expect.objectContaining({ reason: "timeout" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET_KEY);
  });

  it("sends the previous question and answer on the next turn", async () => {
    process.env.OPENAI_API_KEY = SECRET_KEY;
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return sseResponse("Frame the jaw, then angle off the cage.");
      }),
    );
    const user = await makeCoachUser("cage-history@example.com");
    await runCoachChatStream({
      user,
      body: { kind: "chat", message: CAGE_Q, topic: "martial_art", art: "mma" },
    });
    await runCoachChatStream({
      user,
      body: {
        kind: "chat",
        message: "what about in amateur?",
        topic: "martial_art",
        art: "mma",
      },
    });
    const second = JSON.parse(bodies[1]) as {
      messages: { role: string; content: string }[];
    };
    expect(second.messages.some((row) => row.role === "user" && row.content === CAGE_Q)).toBe(true);
    expect(
      second.messages.some(
        (row) => row.role === "assistant" && /frame the jaw/i.test(row.content),
      ),
    ).toBe(true);
    expect(second.messages.at(-1)?.content).toBe("what about in amateur?");
    expect(classifyQuestion("what about in amateur?", lane).primary).toBe("rules");
    expect(second.messages[0]?.content).toMatch(/Verdict|Legal/);
  });
});
