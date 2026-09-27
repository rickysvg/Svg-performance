import Link from "next/link";

export function PageBackLink({ href = "/home" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Back"
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <path
          d="M10 3.5 5.5 8 10 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
