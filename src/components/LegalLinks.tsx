import Link from "next/link";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-4 text-sm ${className}`.trim()}>
      <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="text-accent underline-offset-4 hover:underline">
        Terms
      </Link>
    </nav>
  );
}
