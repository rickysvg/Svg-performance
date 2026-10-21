import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("round timer sheet", () => {
  it("keeps the /timer route and opens the existing timer in a dialog", () => {
    const page = source("src/app/(member)/timer/page.tsx");
    const timer = source("src/components/timer/RoundTimer.tsx");
    const button = source("src/components/timer/RoundTimerButton.tsx");
    expect(page).toContain("<RoundTimer");
    expect(timer).toContain("data-round-clock");
    expect(button).toContain('role="dialog"');
    expect(button).toContain('aria-modal="true"');
    expect(button).toContain("data-round-timer-sheet");
    expect(button).toContain("data-round-timer-button");
    expect(button).toContain('aria-label={named ? undefined : "Start rounds"}');
    expect(button).toContain("createPortal");
    expect(button).not.toContain('href="/timer"');
    expect(button).not.toContain("router.push");
    expect(timer).toContain('aria-label="Close timer"');
    expect(timer).toContain("startRoundLogAction");
    expect(timer).toContain("launch || onClose");
  });

  it("places Start rounds on Bagwork and the stopwatch on Train, Mobility, and Sparring", () => {
    const bagwork = source("src/app/(member)/bagwork/page.tsx");
    const setup = source("src/components/bagwork/BagRoundSetup.tsx");
    const detail = source("src/components/bagwork/BagWorkoutDetail.tsx");
    const day = source("src/app/(member)/training/[dayId]/page.tsx");
    const logger = source("src/components/training/WorkoutLogForm.tsx");
    const play = source("src/app/(member)/mobility/[routineId]/play/page.tsx");
    const routine = source("src/app/(member)/mobility/[routineId]/page.tsx");
    const log = source("src/app/(member)/mobility/[routineId]/log/page.tsx");
    const sparring = source("src/app/(member)/sparring/page.tsx");

    expect(bagwork).toContain('<RoundTimerButton label="Start rounds" />');
    expect(setup).toContain('label="Start rounds"');
    expect(setup).toContain("data-bag-round-setup");
    expect(setup).not.toContain('action="/timer"');
    expect(detail).toContain("workoutName={view.name}");
    expect(day).toContain("<RoundTimerButton />");
    expect(logger).toContain("<RoundTimerButton />");
    expect(logger).toContain("data-logger-chrome");
    expect(play).toContain("<RoundTimerButton />");
    expect(routine).toContain("<RoundTimerButton />");
    expect(log).toContain("<RoundTimerButton />");
    expect(sparring).toContain("<RoundTimerButton />");
    expect(sparring).toContain("data-sparring-page");
  });
});
