import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/session";

export default async function NotFound() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} role={user?.role} />
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="text-2xl">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          That page does not exist, or you do not have access to it.
        </p>
        <Link
          href={user ? "/home" : "/"}
          className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Home
        </Link>
      </main>
    </div>
  );
}
