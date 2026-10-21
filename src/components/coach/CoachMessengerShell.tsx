"use client";

import { useEffect, useState, type ReactNode } from "react";

function keyboardOverlap() {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

export function CoachMessengerShell({ children }: { children: ReactNode }) {
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => setKeyboard(keyboardOverlap());
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  return (
    <main
      data-coach-messenger
      className="fixed inset-x-0 z-10 mx-auto flex w-full max-w-3xl flex-col overflow-hidden bg-background top-[env(safe-area-inset-top)] bottom-[calc(3.75rem+env(safe-area-inset-bottom)+var(--coach-keyboard,0px))] md:top-[calc(3.5rem+env(safe-area-inset-top))]"
      style={{ ["--coach-keyboard" as string]: `${keyboard}px` }}
    >
      {children}
    </main>
  );
}
