import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";

export default async function BillingSuccessPage() {
  const user = await getCurrentUser();
  const subscription = user ? await getLatestSubscription(user.id) : null;
  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Checkout returned</h1>
        <p className="mt-3 text-sm text-muted">
          This page does <strong className="text-foreground">not</strong> unlock
          paid tools by itself. Access changes only after Stripe sends a
          verified webhook.
        </p>
        <p className="mt-4 text-sm">
          Current recorded status:{" "}
          {subscription ? `${subscription.plan} / ${subscription.status}` : "none yet"}
        </p>
        <Link href="/home" className="mt-6 inline-flex text-accent underline">
          Home
        </Link>
      </main>
    </div>
  );
}
