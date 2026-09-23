export function StatusBanner({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) {
    return null;
  }
  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm ${
        error
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-black/20 bg-accent text-black"
      }`}
    >
      {error || success}
    </div>
  );
}
