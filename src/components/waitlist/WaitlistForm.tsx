"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { StatusBanner } from "@/components/StatusBanner";
import {
  honeypotFilled,
  isWaitlistLive,
  parseWaitlistBody,
  WAITLIST_ACADEMY_NOTE,
  WAITLIST_ALREADY_MESSAGE,
  WAITLIST_BUTTON,
  WAITLIST_CONFIRM_AFTER,
  WAITLIST_CONFIRM_BEFORE,
  WAITLIST_CONFIRM_DATE,
  WAITLIST_DISCIPLINES,
  WAITLIST_GENERIC_ERROR,
  WAITLIST_HONEYPOT_FIELD,
  WAITLIST_MEMBER_QUESTION,
  WAITLIST_START_TRAINING,
  WAITLIST_TRAIN_LABEL,
  WAITLIST_WEB_LINE,
  waitlistConfirmHeadline,
  type WaitlistMember,
} from "@/lib/waitlist-shared";

const fieldClass = "mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-3 text-base text-white";

export function WaitlistConfirmation({
  firstName,
  live = isWaitlistLive(),
}: {
  firstName: string;
  live?: boolean;
}) {
  return (
    <section data-testid="waitlist-confirmation" className="mt-8 space-y-4">
      <h2 className="text-4xl text-white sm:text-5xl">{waitlistConfirmHeadline(firstName)}</h2>
      <p className="text-base leading-relaxed text-white/85">
        {WAITLIST_CONFIRM_BEFORE}
        <strong className="text-[#CBF805]">{WAITLIST_CONFIRM_DATE}</strong>
        {WAITLIST_CONFIRM_AFTER}
      </p>
      {live ? (
        <div className="space-y-3 pt-2">
          <Link
            href="/register"
            className="touch-target inline-flex w-full items-center justify-center rounded-full bg-accent px-5 text-base text-black"
          >
            {WAITLIST_START_TRAINING}
          </Link>
          <p className="text-sm text-white/80">{WAITLIST_WEB_LINE}</p>
        </div>
      ) : null}
    </section>
  );
}

export function WaitlistForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [member, setMember] = useState<WaitlistMember>("No");
  const [doneName, setDoneName] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      firstName: String(form.get("firstName") ?? ""),
      email: String(form.get("email") ?? ""),
      train: String(form.get("train") ?? ""),
      member,
      [WAITLIST_HONEYPOT_FIELD]: String(form.get(WAITLIST_HONEYPOT_FIELD) ?? ""),
    };
    if (!honeypotFilled(body)) {
      const parsed = parseWaitlistBody(body);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
    }
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        firstName?: string;
      } | null;
      if (response.status === 409 || payload?.error === WAITLIST_ALREADY_MESSAGE) {
        setError(WAITLIST_ALREADY_MESSAGE);
        return;
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || WAITLIST_GENERIC_ERROR);
        return;
      }
      const typed = String(form.get("firstName") ?? "").trim();
      setDoneName(payload.firstName?.trim() || typed);
    } catch {
      setError(WAITLIST_GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (doneName !== null) {
    return <WaitlistConfirmation firstName={doneName} />;
  }

  return (
    <form data-testid="waitlist-form" onSubmit={onSubmit} className="relative mt-8 space-y-4" noValidate>
      <StatusBanner error={error} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input
            name={WAITLIST_HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-white/80">First name</span>
        <input
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          placeholder="First name"
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-sm text-white/80">Email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-sm text-white/80">{WAITLIST_TRAIN_LABEL}</span>
        <select name="train" defaultValue="" className={fieldClass}>
          <option value="">{WAITLIST_TRAIN_LABEL}</option>
          {WAITLIST_DISCIPLINES.map((discipline) => (
            <option key={discipline} value={discipline}>
              {discipline}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm text-white/80">{WAITLIST_MEMBER_QUESTION}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["No", "Yes"] as const).map((choice) => {
            const selected = member === choice;
            return (
              <label key={choice} className="block">
                <input
                  className="sr-only"
                  type="radio"
                  name="member"
                  value={choice}
                  checked={selected}
                  onChange={() => setMember(choice)}
                />
                <span
                  className={`touch-target flex items-center justify-center rounded-full border text-base ${
                    selected
                      ? "border-accent bg-accent text-black"
                      : "border-white/20 bg-black text-white"
                  }`}
                >
                  {choice}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <button
        type="submit"
        data-testid="waitlist-submit"
        disabled={pending}
        aria-busy={pending}
        className="touch-target w-full rounded-full bg-accent px-5 text-base text-black disabled:opacity-70"
      >
        {WAITLIST_BUTTON}
      </button>
      <p className="text-sm leading-relaxed text-white/75">{WAITLIST_ACADEMY_NOTE}</p>
    </form>
  );
}
