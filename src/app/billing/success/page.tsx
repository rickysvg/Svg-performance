import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { BillingPendingNote } from "@/components/billing/BillingPendingNote";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { getCurrentUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { fulfillCheckoutReturnForUser } from "@/lib/checkout-return";
import { subscriptionFace } from "@/lib/subscription-copy";
import { revalidatePath } from "next/cache";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  const sessionId = typeof query.session_id === "string" ? query.session_id : "";
  let forbidden = false;
  if (user && sessionId.startsWith("cs_")) {
    const existing = await getLatestSubscription(user.id);
    const result = await fulfillCheckoutReturnForUser({
      userId: user.id,
      sessionId,
      knownCustomerId: existing?.stripeCustomerId || undefined,
    });
    forbidden = result.reason === "forbidden";
    if (result.ok) {
      revalidatePath("/plan");
      revalidatePath("/profile");
      revalidatePath("/home");
    }
  }
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const pending = Boolean(sessionId) && !subscription?.stripeCustomerId && !forbidden;

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Checkout returned</h1>
        <p className="mt-3 text-sm text-muted">
          {forbidden
            ? "This checkout belongs to a different account."
            : "This page saves the checkout on your account. Stripe’s webhook confirms the same subscription. No refunds except billing errors."}
        </p>
        <p className="mt-4 text-sm">
          Your plan:{" "}
          {subscription ? subscriptionFace(subscription.plan, subscription.status) : "waiting on Stripe"}
        </p>
        {pending ? <BillingPendingNote /> : null}
        {subscription?.stripeCustomerId ? (
          <div className="mt-4">
            <ManageBillingButton />
          </div>
        ) : null}
        <LegalLinks className="mt-6" />
        <Link
          href={pending ? "/plan?billing=pending" : "/plan"}
          className="mt-6 inline-flex text-accent underline"
        >
          Your plan
        </Link>
      </main>
    </div>
  );
}
