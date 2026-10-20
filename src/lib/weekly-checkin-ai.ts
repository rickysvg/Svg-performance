import { isOpenAiConfigured, openAiApiKey, openAiModel } from "@/lib/coach/llm";
import {
  detectCheckInFlags,
  fallbackCheckInDraft,
  type CheckInDraft,
  type CheckInScores,
} from "@/lib/weekly-checkin-shared";

const RICKY_VOICE = [
  "You are Ricky, head coach at SVG MMA Academy, writing one weekly check-in reply.",
  "Voice: short sentences, the standard, and the next action. Direct. No fluff and no shame. No emojis.",
  "You may use the phrase \"No fluff.\" at most once.",
  "Do not invent loads, calories, a medical diagnosis, or a new program.",
  "If injury or head contact is flagged, tell them to get checked when symptoms show, and do not prescribe treatment.",
  "Plan tweaks change the week they already have. No punishment volume after missed sessions.",
].join(" ");

export type CheckInAiInput = CheckInScores & { displayName?: string };

function threeLines(text: string, fallback: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
  const base = fallback.split("\n").map((line) => line.trim());
  while (lines.length < 3) lines.push(base[lines.length] || "Stay on the week.");
  return lines.slice(0, 3).join("\n");
}

function stripFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

/** Live check-in drafts stay off unless CHECKIN_AI=1, so a stored API key does not spend. */
export function checkInAiEnabled() {
  const raw = process.env.CHECKIN_AI?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

export async function generateCheckInDraft(input: CheckInAiInput): Promise<CheckInDraft> {
  const fallback = fallbackCheckInDraft(input);
  if (!checkInAiEnabled() || !isOpenAiConfigured()) return fallback;

  const flags = detectCheckInFlags(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: openAiModel(),
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: RICKY_VOICE },
          {
            role: "user",
            content: [
              "Write JSON with keys summary, reply, tweaks.",
              "summary: exactly 3 lines separated by newline. Line 1 is weight, sleep, energy, stress. Line 2 is sessions and sparring. Line 3 is wins and struggles. No extra lines.",
              "reply: the message Ricky sends the athlete. 4 to 8 short sentences.",
              "tweaks: one short paragraph of plan changes, or \"No plan change.\"",
              "Use these red flags as given. Do not add flags that are not listed.",
              `Flags: ${flags.length ? flags.map((flag) => `${flag.label}: ${flag.detail}`).join(" | ") : "none"}.`,
              `Athlete: ${input.displayName?.trim() || "Athlete"}.`,
              `Bodyweight lb: ${input.bodyweightLb ?? "unknown"}. Previous lb: ${input.previousWeightLb ?? "unknown"}.`,
              `Sleep ${input.sleepQuality}/5, energy ${input.energy}/5, stress ${input.stress}/5. Previous energy: ${input.previousEnergy ?? "unknown"}.`,
              `Sessions ${input.sessionsCompleted} of ${input.sessionsPlanned}.`,
              `Sparring: ${input.sparringSummary.trim() || "none logged"}.`,
              `Soreness notes: ${input.sorenessNotes.trim() || "none"}. Regions: ${input.regions.join(", ") || "none"}.`,
              `Wins: ${input.wins.trim() || "none"}.`,
              `Struggles: ${input.struggles.trim() || "none"}.`,
            ].join("\n"),
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn("[check-in] live model unavailable", { status: response.status });
      return fallback;
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripFence(content)) as {
      summary?: unknown;
      reply?: unknown;
      tweaks?: unknown;
    };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const tweaks = typeof parsed.tweaks === "string" ? parsed.tweaks.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!reply || !summary) return fallback;
    return {
      summary: threeLines(summary, fallback.summary),
      flags,
      reply: reply.slice(0, 2000),
      tweaks: (tweaks || fallback.tweaks).slice(0, 800),
      source: "openai",
    };
  } catch (error) {
    console.warn("[check-in] live model unavailable", {
      reason: error instanceof Error ? error.name : "error",
    });
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
