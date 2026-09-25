import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page does not exist, or you do not have access to it.
      </p>
      <Link href="/" className="mt-6 text-accent underline-offset-4 hover:underline">
        Back to SVG Performance
      </Link>
    </main>
  );
}
