import Link from "next/link";

export default function MemberNotFound() {
  return (
    <main className="space-y-4 py-10">
      <h1 className="text-3xl">Page not found</h1>
      <p className="text-sm text-muted">
        That page does not exist, or you do not have access to it.
      </p>
      <Link
        href="/home"
        className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
      >
        Back to Home
      </Link>
    </main>
  );
}
