"use client";

import { UpgradeCtas } from "@/components/upgrade/UpgradeCtas";

function trialBlurb(trialDays: number, rest: string) {
  const days = trialDays > 0 ? trialDays : 7;
  return `${rest} Start the ${days}-day Pro trial — no card — or upgrade from Profile.`;
}

const BLURBS: Record<string, { title: string; body: string; trial?: boolean }> = {
  tutorial: {
    title: "This lesson is in Pro",
    body: "Academy members get the rounds, mobility, and form libraries with their dues. Pro opens every lesson.",
    trial: true,
  },
  seminar: {
    title: "This seminar is in Pro",
    body: "Intermediate and advanced seminars, and their technique clips, open on Pro.",
    trial: true,
  },
  fuel: {
    title: "AI meal feedback is in Pro",
    body: "Fuel logging is included for academy members. AI feedback on your meals opens on Pro.",
  },
  coach: {
    title: "SVG Coach chat is in Pro",
    body: "Your free week of AI coach chat has ended. SVG Coach is an AI coach trained on striking, grappling, strength and conditioning, and fight mindset. Chat stays open on Pro and VIP Coaching.",
  },
  ai_limit: {
    title: "You used this week's 3 AI messages",
    body: "Your next message opens on Pro: daily AI coach chat, AI feedback on check-ins and meals, and full history. Logging workouts, timers, and class programming stay open.",
  },
  ai_daily_cap: {
    title: "That's today's AI fair-use limit",
    body: "Pro includes 30 AI messages a day. It resets tomorrow. Logging and timers stay open.",
  },
  voice: {
    title: "Coach voices are in Pro",
    body: "Hear your coach out loud with Pro. Up to 20 minutes of voice a day.",
  },
  read_aloud: {
    title: "Hearing today's summary is in Pro",
    body: "Pro reads your day out loud once a day. The written summary stays on Home.",
  },
  coach_take: {
    title: "Your coach's take is in Pro",
    body: "Your check-in is saved. Pro adds AI feedback on every check-in and meal, and RIR auto-adjust after sparring or low readiness.",
  },
  charts: {
    title: "Sparring trends are in Pro",
    body: "Your logs are saved. Pro shows sparring and body trends and your full history.",
  },
  mobility: {
    title: "This mobility routine is in Pro",
    body: "Academy members get the mobility library with their dues.",
    trial: true,
  },
  fight_camp: {
    title: "Fight camp is in Pro",
    body: "Build a week-by-week camp from your fight date: base, build, peak / sharpen, and a fight-week taper.",
    trial: true,
  },
  form_check: {
    title: "Form check is in Pro",
    body: "Send two short clips a month. A real coach writes the note, and it shows up signed SVG Coach.",
  },
  history: {
    title: "Older history is in Pro",
    body: "Academy members see the last 30 days. Pro shows your full history. Your data is saved and you can export it anytime from Profile.",
  },
};

export function UpgradePreview({
  kind,
  canStartTrial,
  trialDays,
  next = "/home",
  onDismiss,
  framed = true,
}: {
  kind: keyof typeof BLURBS;
  canStartTrial: boolean;
  trialDays: number;
  next?: string;
  onDismiss?: () => void;
  framed?: boolean;
}) {
  const copy = BLURBS[kind];
  const body = copy.trial ? trialBlurb(trialDays, copy.body) : copy.body;
  const carbon = kind === "coach";
  return (
    <section
      className={
        carbon
          ? "hc-panel hc-carbon relative p-5 text-white"
          : framed
            ? "rounded-2xl border border-line bg-white p-5"
            : "bg-white"
      }
    >
      <p
        className={`font-display text-xs uppercase tracking-[0.06em] ${carbon ? "text-[#CBF805]" : "text-black"}`}
      >
        SVG Pro
      </p>
      <h2
        className={`font-display mt-2 text-2xl uppercase tracking-wide ${carbon ? "text-white" : "text-black"}`}
      >
        {copy.title}
      </h2>
      <p className={`mt-2 text-sm ${carbon ? "text-white/80" : "text-muted"}`}>{body}</p>
      <div className="mt-4 space-y-3">
        <UpgradeCtas
          canStartTrial={canStartTrial}
          trialDays={trialDays}
          next={next}
          upgradeLabel={kind === "coach" ? "Upgrade" : undefined}
        />
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={
              carbon
                ? "touch-target w-full rounded-full border border-[#CBF805]/50 bg-transparent font-semibold text-[#CBF805]"
                : "touch-target w-full rounded-full border border-black bg-white font-semibold text-black"
            }
          >
            Not now
          </button>
        ) : null}
      </div>
      <p className={`mt-3 text-xs ${carbon ? "text-white/60" : "text-muted"}`}>
        Pro is $9.99/mo or $72.99/yr, save 39%.
      </p>
    </section>
  );
}
