import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TOAST_DISMISS_MS } from "@/components/Toast";
import { REMOVE_TOAST_MS } from "@/components/training/RemoveToast";
import { bodyMetricSaveMessage } from "@/lib/body-metric-copy";

describe("dismissible toasts", () => {
  it("confirms a weigh-in in a short line and drops the wearable disclaimer", () => {
    expect(bodyMetricSaveMessage("weight", 18.4)).toBe("Weight & body fat saved.");
    expect(bodyMetricSaveMessage("weight", null)).toBe("Saved.");
    expect(bodyMetricSaveMessage("sleepHours", null)).toBe("Saved.");
    expect(bodyMetricSaveMessage("weight", 18.4)).not.toMatch(/watch|wearable/i);
  });

  it("auto-dismisses a confirmation in about three seconds and keeps undo longer", () => {
    expect(TOAST_DISMISS_MS).toBe(3000);
    expect(REMOVE_TOAST_MS).toBe(8000);
  });

  it("shares one toast that closes itself and clears the coach button", () => {
    const root = process.cwd();
    const toast = fs.readFileSync(path.join(root, "src/components/Toast.tsx"), "utf8");
    const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
    const weigh = fs.readFileSync(path.join(root, "src/components/home/HomeBodyWeight.tsx"), "utf8");
    const move = fs.readFileSync(path.join(root, "src/components/training/WorkoutMove.tsx"), "utf8");
    const remove = fs.readFileSync(path.join(root, "src/components/training/RemoveToast.tsx"), "utf8");
    const feedback = fs.readFileSync(path.join(root, "src/components/feedback/FeedbackForm.tsx"), "utf8");
    const action = fs.readFileSync(path.join(root, "src/app/actions/body-metrics.ts"), "utf8");

    expect(toast).toContain("data-toast-close");
    expect(toast).toContain("h-11 w-11");
    expect(toast).toContain("TOAST_DISMISS_MS");
    expect(weigh).toContain("<Toast");
    expect(weigh).not.toContain("6.75rem + env(safe-area-inset-bottom)");
    expect(move).toContain("<Toast");
    expect(move).not.toContain("5.5rem");
    expect(remove).toContain("<Toast");
    expect(remove).not.toContain("5.5rem");
    expect(feedback).toContain("<Toast");
    expect(feedback).not.toContain("pointer-events-none");
    expect(action).not.toMatch(/watch or wearable/);
    expect(css).toContain("bottom: calc(9.25rem + 48px + 0.75rem + env(safe-area-inset-bottom, 0px));");
    expect(css).toContain(
      "html:has([data-coach-fab-raised]) .app-toast:not(.app-toast-top)",
    );
    expect(css).toContain("bottom: calc(10.25rem + 48px + 0.75rem + env(safe-area-inset-bottom, 0px));");
  });
});
