-- Lookup renewals and the billing portal by Stripe customer id.
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
