"use client";

import { ErrorState } from "@/components/EmptyState";

export default function MemberError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState title="This page hit a snag" onRetry={reset}>
      Try again. Your account, workouts, and food logs were not erased.
    </ErrorState>
  );
}
