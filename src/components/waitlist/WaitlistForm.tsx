"use client";

import { useState, type FormEvent } from "react";
import type { WaitlistResponse } from "@/lib/drop-waitlist";

export function WaitlistForm({ configured }: { configured: boolean }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<WaitlistResponse | null>(null);

  if (!configured) {
    return (
      <section className="hc-panel hc-carbon px-4 py-5" data-waitlist-soon>
        <p className="hc-kicker">List</p>
        <h2 className="mt-2 text-2xl">Coming soon</h2>
        <p className="mt-2 text-sm text-muted">
          The email list opens when mail is connected. Nothing is broken — check back before Nov 16.
        </p>
      </section>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          firstName: String(data.get("firstName") ?? ""),
          academyMember: String(data.get("academyMember") ?? ""),
          consent: data.get("consent") === "on",
        }),
      });
      const body = (await response.json()) as WaitlistResponse;
      setResult(body);
      if (body.state === "pending") form.reset();
    } catch {
      setResult({
        state: "error",
        message: "We couldn't add you just now. Try again in a minute.",
      });
    } finally {
      setPending(false);
    }
  }

  const tone =
    result?.state === "pending" || result?.state === "exists"
      ? "border-[#CBF805] text-[#CBF805]"
      : "border-signal text-signal";

  return (
    <form onSubmit={onSubmit} className="hc-panel hc-carbon space-y-4 px-4 py-5" data-waitlist-form>
      <div>
        <p className="hc-kicker">List</p>
        <h2 className="mt-2 text-2xl">Join the drop</h2>
      </div>
      {result ? (
        <p role="status" data-waitlist-state={result.state} className={`border px-3 py-3 text-sm ${tone}`}>
          {result.message}
        </p>
      ) : null}
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          className="mt-1 w-full border border-[#243024] bg-black/45 px-3 py-3 text-base"
        />
      </label>
      <label className="block text-sm">
        First name
        <span className="mt-0.5 block text-xs text-muted">Optional</span>
        <input
          name="firstName"
          type="text"
          autoComplete="given-name"
          maxLength={40}
          className="mt-1 w-full border border-[#243024] bg-black/45 px-3 py-3 text-base"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm">SVG Academy member?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["yes", "Yes"],
              ["no", "No"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-2 border border-[#243024] bg-black/45 px-3 text-sm"
            >
              <input type="radio" name="academyMember" value={value} required className="accent-[#CBF805]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 accent-[#CBF805]" />
        <span>
          Email me about the Nov 16 drop. Mailchimp sends the confirmation and the unsubscribe link.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full bg-[#CBF805] px-4 text-base text-black disabled:opacity-60"
      >
        {pending ? "Sending…" : "Join the list"}
      </button>
    </form>
  );
}
