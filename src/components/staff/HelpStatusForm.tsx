import { updateHelpRequestStatusAction } from "@/app/actions/help";
import { HELP_STATUSES } from "@/lib/help";

export function HelpStatusForm({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  return (
    <form action={updateHelpRequestStatusAction} className="mt-3 flex flex-wrap gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      {HELP_STATUSES.map((value) => (
        <button
          key={value}
          type="submit"
          name="status"
          value={value}
          disabled={value === status}
          className={`touch-target rounded-full px-4 text-sm ${
            value === status
              ? "bg-accent font-semibold text-black"
              : "border border-line"
          }`}
        >
          {value}
        </button>
      ))}
    </form>
  );
}
