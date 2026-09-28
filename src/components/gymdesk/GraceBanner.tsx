export function GraceBanner({ endsOn }: { endsOn: string }) {
  return (
    <div
      role="status"
      className="mb-4 rounded-2xl border border-black bg-accent px-4 py-3 text-sm text-black"
    >
      Your academy membership shows as inactive. Member pricing ends on {endsOn}.
    </div>
  );
}
