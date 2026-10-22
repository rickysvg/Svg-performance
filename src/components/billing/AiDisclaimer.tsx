import { AI_DISCLAIMER } from "@/lib/plans";

export function AiDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted ${className}`.trim()}>
      {AI_DISCLAIMER}
    </p>
  );
}
