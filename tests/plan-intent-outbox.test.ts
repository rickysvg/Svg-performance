import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  flushPendingIntentsOnUnload,
  planIntentUnloadBody,
  resetPlanIntentOutboxForTests,
  setPlanIntentTransport,
  submitPlanIntent,
  type PlanIntent,
  type PlanIntentResult,
} from "@/lib/plan-intent-outbox";

function intent(intentSeq: number, toDay = "Wednesday"): PlanIntent {
  return {
    sessionKey: "Sunday:demo-strength-base:8",
    weekStart: "2026-10-19",
    toDay,
    intentSeq,
    intent: intentSeq % 2 === 0 ? "restore" : "move",
  };
}

function ack(item: PlanIntent, applied = true, seq = item.intentSeq): PlanIntentResult {
  return { intentSeq: item.intentSeq, applied, seq };
}

describe("plan intent outbox", () => {
  beforeEach(() => {
    resetPlanIntentOutboxForTests();
  });

  afterEach(() => {
    setPlanIntentTransport(null);
    resetPlanIntentOutboxForTests();
  });

  it("retries the last intent until the server acknowledges it", async () => {
    let calls = 0;
    setPlanIntentTransport(async (intents) => {
      calls += 1;
      if (calls < 3) throw new Error("network");
      return intents.map((item) => ack(item));
    });
    const result = await submitPlanIntent(intent(24));
    expect(calls).toBe(3);
    expect(result.applied).toBe(true);
    expect(result.seq).toBe(24);
    expect(planIntentUnloadBody()).toBeNull();
  });

  it("keeps a newer click when an older request is still in flight", async () => {
    let releaseFirst: (value: PlanIntentResult[]) => void = () => {};
    let calls = 0;
    const seen: number[][] = [];
    setPlanIntentTransport((intents) => {
      calls += 1;
      seen.push(intents.map((item) => item.intentSeq));
      if (calls === 1) {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve(intents.map((item) => ack(item)));
    });
    const older = submitPlanIntent(intent(23, "Saturday"));
    const newer = submitPlanIntent(intent(24, "Wednesday"));
    const superseded = await older;
    expect(superseded.superseded).toBe(true);
    releaseFirst([ack(intent(23, "Saturday"))]);
    const saved = await newer;
    expect(saved.applied).toBe(true);
    expect(saved.seq).toBe(24);
    expect(seen.flat()).toContain(24);
  });

  it("sends the unacknowledged intent on unload", async () => {
    let release: (value: PlanIntentResult[]) => void = () => {};
    setPlanIntentTransport(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = submitPlanIntent(intent(24, "Wednesday"));
    const bodies: Blob[] = [];
    const previous = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        sendBeacon: (_url: string, body: Blob) => {
          bodies.push(body);
          return true;
        },
      },
    });
    flushPendingIntentsOnUnload();
    expect(planIntentUnloadBody()).toContain('"intentSeq":24');
    expect(planIntentUnloadBody()).toContain("Wednesday");
    expect(bodies).toHaveLength(1);
    expect(await bodies[0]?.text()).toContain('"intentSeq":24');
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
    release([ack(intent(24))]);
    await pending;
  });
});
