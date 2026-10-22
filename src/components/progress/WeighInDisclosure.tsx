"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Escape collapses the disclosure. A sheet that already handled Escape wins. */
export function shouldCollapseWeighIn(input: {
  key: string;
  defaultPrevented: boolean;
  open: boolean;
  inside: boolean;
}) {
  return input.key === "Escape" && !input.defaultPrevented && input.open && input.inside;
}

export function WeighInDisclosure({
  startOpen = false,
  children,
}: {
  startOpen?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const details = ref.current;
      const target = event.target instanceof Node ? event.target : null;
      const active = document.activeElement;
      const inside = Boolean(
        details &&
          ((target && details.contains(target)) ||
            (active instanceof Node && details.contains(active))),
      );
      if (
        !shouldCollapseWeighIn({
          key: event.key,
          defaultPrevented: event.defaultPrevented,
          open: Boolean(details?.open),
          inside,
        })
      ) {
        return;
      }
      event.preventDefault();
      if (details) details.open = false;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <details
      id="log-body-fat"
      ref={ref}
      className="scroll-mt-4"
      {...(startOpen ? { open: true } : {})}
    >
      {children}
    </details>
  );
}
