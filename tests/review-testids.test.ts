import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("review test ids", () => {
  it("uses one id per close control and the requested names for the missing controls", () => {
    const files = [
      "src/components/Toast.tsx",
      "src/components/timer/RoundTimer.tsx",
      "src/components/timer/BikeClockScreen.tsx",
      "src/components/timer/TimerDurationFields.tsx",
      "src/components/training/BikeWorkoutSheet.tsx",
      "src/components/training/WorkoutMove.tsx",
      "src/components/training/ExerciseLibrarySheet.tsx",
      "src/components/training/WorkoutLogForm.tsx",
      "src/components/training/SavedWorkoutEditor.tsx",
      "src/components/training/ExerciseNotepad.tsx",
      "src/components/home/HomeBodyWeight.tsx",
      "src/components/upgrade/UpgradePreviewSheet.tsx",
      "src/components/upgrade/AiPaywallPrompt.tsx",
      "src/components/coach/CoachSpeakButton.tsx",
    ];
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const id of [
      "toast-action-btn",
      "round-timer-set-prefs-toggle",
      "round-timer-set-prefs-toggle-2",
      "round-timer-set-prefs-toggle-3",
      "round-timer-button-on-close-sheet-close",
      "round-timer-button-on-close-sheet-close-2",
      "timer-duration-fields-sheet-close",
      "bike-workout-sheet-sheet-close",
      "bike-workout-sheet-sheet-close-2",
      "ai-paywall-prompt-sheet-close",
      "coach-speak-button-sheet-close",
      "home-body-weight-sheet-close",
      "home-body-weight-sheet-close-2",
      "upgrade-preview-sheet-children-btn",
      "upgrade-preview-sheet-sheet-close",
      "exercise-notepad-sheet-close",
      "exercise-notepad-sheet-close-2",
      "workout-log-form-input-4",
      "workout-log-form-input-5",
      "workout-log-form-sheet-close",
      "saved-workout-editor-sheet-close",
      "workout-move-session-btn",
      "workout-move-session-btn-2",
      "workout-move-cancel",
    ]) {
      expect(source, id).toContain(id);
    }
    expect(source).not.toContain("chrome-round-timer-close");
    expect(source).not.toContain("training-swap-session");
    expect(source).not.toContain("home-sheet-open");
    expect(source).not.toContain("training-cancel-2");
  });
});
