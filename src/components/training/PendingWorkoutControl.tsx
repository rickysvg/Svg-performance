"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { useEffect, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function pendingWorkoutLabel(label: string) {
  return /resume/i.test(label) ? "Resuming…" : "Starting…";
}

/** How long a click may sit before we treat the navigation as cancelled. */
const NAV_GRACE_MS = 1500;

/**
 * Pending only after a click that was not cancelled. A touch that turns into a
 * scroll never clicks, so the label stays put. If the route does not start,
 * the label returns.
 */
function useClickPending(navigating: boolean) {
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (!activated || navigating) return;
    const timer = window.setTimeout(() => setActivated(false), NAV_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [activated, navigating]);
  return {
    busy: navigating || activated,
    onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      setActivated(true);
    },
  };
}

function PendingLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  const click = useClickPending(pending);
  return (
    <span aria-busy={click.busy} onClick={click.onClick}>
      {click.busy ? pendingWorkoutLabel(label) : label}
    </span>
  );
}

type LinkProps = ComponentProps<typeof Link>;

/** Start/Resume link. The label flips on press, before the logger route answers. */
export function PendingWorkoutLink({
  label,
  children,
  prefetch,
  ...props
}: LinkProps & { label?: string; children?: ReactNode }) {
  const text = label ?? (typeof children === "string" ? children : "Start");
  return (
    <Link prefetch={prefetch ?? false} {...props}>
      <PendingLabel label={text} />
    </Link>
  );
}

type ButtonProps = ComponentProps<"button"> & { label: string; pendingLabel?: string };

/** Submit inside a start/resume form. useFormStatus only sees a parent form. */
export function PendingSubmitButton({ label, pendingLabel, onClick, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const click = useClickPending(pending);
  return (
    <button
      {...props}
      type="submit"
      aria-busy={click.busy}
      onClick={(event) => {
        onClick?.(event);
        click.onClick(event);
      }}
    >
      {click.busy ? (pendingLabel ?? pendingWorkoutLabel(label)) : label}
    </button>
  );
}
