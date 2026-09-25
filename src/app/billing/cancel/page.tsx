import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/session";

export default async function BillingCancelPage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Checkout canceled</h1>
        <p className="mt-3 text-sm text-muted">
          No access change was made. Failed or canceled TEST payments never
          grant a plan — including Affirm or Klarna.
        </p>
        <Link href="/pricing" className="mt-6 inline-flex text-accent underline">
          Back to pricing
        </Link>
      </main>
    </div>
  );
}
