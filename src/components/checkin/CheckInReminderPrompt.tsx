"use client";

import { useEffect, useState } from "react";

type Phase = "loading" | "on" | "off" | "denied" | "ios" | "unsupported" | "unconfigured";

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function CheckInReminderPrompt() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function look() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setPhase(isIos() && !isStandalone() ? "ios" : "unsupported");
        return;
      }
      if (isIos() && !isStandalone()) {
        if (!cancelled) setPhase("ios");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setPhase("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = await registration?.pushManager.getSubscription();
        if (!cancelled) setPhase(existing ? "on" : "off");
      } catch {
        if (!cancelled) setPhase("off");
      }
    }
    void look();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setError("");
    setPending(true);
    try {
      const config = await fetch("/api/push/config").then((response) => response.json());
      if (!config?.configured || !config.publicKey) {
        setPhase("unconfigured");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPhase(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      const json = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!response.ok) {
        setError("Could not save the reminder. Try again.");
        return;
      }
      setPhase("on");
    } catch {
      setError("Could not turn on reminders in this browser.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading" || phase === "unsupported") return null;

  return (
    <section className="rounded-2xl border border-line bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">Reminders</p>
      {phase === "ios" ? (
        <>
          <h2 className="mt-1 text-xl">Add the app to your Home Screen</h2>
          <p className="mt-2 text-sm text-muted">
            iPhone only delivers check-in reminders from the Home Screen icon. In Safari, tap
            Share, then Add to Home Screen. Open SVG Performance from that icon, then turn
            reminders on.
          </p>
        </>
      ) : null}
      {phase === "denied" ? (
        <p className="mt-2 text-sm">
          Notifications are blocked for this site. Turn them on in the browser settings, then come back.
        </p>
      ) : null}
      {phase === "unconfigured" ? (
        <p className="mt-2 text-sm text-muted">
          Push reminders are not set up on this server yet. You will still get the in-app banner, and an email if mail is on.
        </p>
      ) : null}
      {phase === "on" ? (
        <p className="mt-2 text-sm">Check-in reminders are on for this device.</p>
      ) : null}
      {phase === "off" ? (
        <>
          <h2 className="mt-1 text-xl">Turn on check-in reminders</h2>
          <p className="mt-2 text-sm text-muted">
            One push on your day and time. If you miss it, a follow-up lands the next day.
          </p>
          <button
            data-testid="checkin-turn-on-check-in-reminders"
            type="button"
            onClick={() => void enable()}
            disabled={pending}
            className="touch-target mt-3 w-full rounded-full bg-black text-white disabled:opacity-60"
          >
            {pending ? "Turning on…" : "Turn on check-in reminders"}
          </button>
        </>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
