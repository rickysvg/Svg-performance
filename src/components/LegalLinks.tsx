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
      <Link href="/support" className="text-accent underline-offset-4 hover:underline">
        Support
      </Link>
      <Link href="/delete-account" className="text-accent underline-offset-4 hover:underline">
        Delete account
      </Link>
    </nav>
  );
}
