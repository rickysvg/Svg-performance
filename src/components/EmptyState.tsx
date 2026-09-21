export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-line bg-card p-5 text-sm text-muted"
    >
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  children,
  onRetry,
}: {
  title?: string;
  children?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        {children ?? "Please try again. Your saved workouts and food logs are still here."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="touch-target mt-4 rounded-full bg-accent px-5 font-semibold text-black"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
