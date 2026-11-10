export function ManageBillingButton({
  label = "Manage billing",
  className = "touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-black",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <form method="POST" action="/api/stripe/portal">
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
