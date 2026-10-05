"use client";

import { useCallback, useSyncExternalStore } from "react";
import { setSoundFxEnabled, soundFxEnabled } from "@/lib/badge-sfx";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function SoundEffectsToggle() {
  const on = useSyncExternalStore(subscribe, soundFxEnabled, () => true);
  const toggle = useCallback((next: boolean) => {
    setSoundFxEnabled(next);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg">Sound effects</h2>
      <p className="text-sm text-muted">
        Finish stings, badge unlocks, and rest-timer cues. Off by choice; default is on.
      </p>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => toggle(event.target.checked)}
          className="mt-1 h-5 w-5 accent-accent"
        />
        <span className="text-sm">Sound effects on</span>
      </label>
    </section>
  );
}
