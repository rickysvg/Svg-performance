"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nativePlatform } from "@/lib/native-app";
import {
  getProOffering,
  purchasePackage,
  restorePurchases,
  syncStorePurchase,
  type ProPackageView,
} from "@/lib/native-purchases";

/** One paywall per group. A later sibling with the same marker is hidden in CSS. */
export function NativeProPaywallSlot() {
  return <NativeProPaywall />;
}

export function RestorePurchasesButton({
  className = "touch-target w-full rounded-full border border-line px-5 text-sm font-semibold",
}: {
  className?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        data-restore-purchases
        disabled={pending}
        className={className}
        onClick={() => {
          setPending(true);
          setMessage("");
          void restorePurchases()
            .then(async (result) => {
              if (result.ok) await syncStorePurchase();
              setMessage(result.message);
              if (result.ok) router.refresh();
            })
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Restoring…" : "Restore Purchases"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}

function NativeProPaywall() {
  const router = useRouter();
  const platform = nativePlatform();
  const [packages, setPackages] = useState<ProPackageView[] | null>(null);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState("");
  const billedBy = platform === "android" ? "Google account" : "Apple ID";

  useEffect(() => {
    let cancelled = false;
    void getProOffering()
      .then((rows) => {
        if (!cancelled) setPackages(rows);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function buy(row: ProPackageView) {
    setPendingId(row.id);
    setMessage("");
    const result = await purchasePackage(row.pkg);
    if (result.outcome === "purchased") {
      await syncStorePurchase();
      router.refresh();
    } else if (result.outcome !== "cancelled") {
      setMessage(result.message);
    }
    setPendingId("");
  }

  return (
    <section data-native-pro-paywall className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-lg">SVG Pro</h2>
      <p className="text-sm text-muted">
        Auto-renews until you cancel. Cancel in Settings at least 24 hours before the period ends.
        Payment is charged to your {billedBy}.
      </p>
      {packages === null ? <p className="text-sm text-muted">Loading store prices…</p> : null}
      {packages && packages.length === 0 ? (
        <p className="text-sm text-muted">Subscriptions are not available in this build yet.</p>
      ) : null}
      <div className="space-y-2">
        {(packages ?? []).map((row) => (
          <button
            key={row.id}
            type="button"
            data-store-package={row.id}
            disabled={Boolean(pendingId)}
            onClick={() => void buy(row)}
            className="touch-target w-full rounded-full bg-accent px-5 text-black disabled:opacity-60"
          >
            {pendingId === row.id ? "Contacting the store…" : `${row.title} · ${row.priceString} / ${row.period}`}
          </button>
        ))}
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <RestorePurchasesButton />
      <p className="text-xs text-muted">
        <Link href="/terms" className="text-accent underline">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="text-accent underline">
          Privacy
        </Link>
      </p>
    </section>
  );
}
