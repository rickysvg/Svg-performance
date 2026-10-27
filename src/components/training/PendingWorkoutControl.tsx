"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function pendingWorkoutLabel(label: string) {
  return /resume/i.test(label) ? "Resuming…" : "Starting…";
}

function PendingLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  const [pressed, setPressed] = useState(false);
  const busy = pending || pressed;
  return (
    <span aria-busy={busy} onPointerDown={() => setPressed(true)}>
      {busy ? pendingWorkoutLabel(label) : label}
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
export function PendingSubmitButton({ label, pendingLabel, onPointerDown, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState(false);
  const busy = pending || pressed;
  return (
    <button
      {...props}
      type="submit"
      aria-busy={busy}
      onPointerDown={(event) => {
        setPressed(true);
        onPointerDown?.(event);
      }}
    >
      {busy ? (pendingLabel ?? pendingWorkoutLabel(label)) : label}
    </button>
  );
}
