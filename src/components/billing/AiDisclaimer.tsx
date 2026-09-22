import { AI_DISCLAIMER } from "@/lib/plans";

export function AiDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted ${className}`.trim()} data-testid="ai-disclaimer">
      {AI_DISCLAIMER}
    </p>
  );
}
