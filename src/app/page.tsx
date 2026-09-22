import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/session";

export default async function MarketingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
        <section className="flex flex-col items-center text-center">
          <Logo variant="lockup" size="lg" priority />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Train with purpose between classes.
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            A private-preview companion for SVG MMA Academy adults in El Paso.
            See what you are working toward, what to do today, and the progress
            you are actually logging.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
            {user ? (
              <Link
                href="/home"
                className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-base font-semibold text-black"
              >
                Open my dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-base font-semibold text-black"
                >
                  Create a preview account
                </Link>
                <Link
                  href="/login"
                  className="touch-target inline-flex items-center justify-center rounded-full border border-line px-5 text-base"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["What am I working toward?", "Save a simple adult profile and a goal you can see on Home."],
            ["What should I do today?", "Open the labeled DEMO strength program and start a session."],
            ["What progress am I making?", "Logged workouts stay after refresh. Charts use your own data."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-line bg-card p-5">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-accent/30 bg-card p-5">
          <h2 className="text-lg font-semibold">What this preview is — and is not</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Auth, workout logs, and your profile are real and stored in a database.</li>
            <li>The strength program is clearly marked DEMO.</li>
            <li>Saying “I am a gym member” does not unlock a discount or paid access.</li>
            <li>
              Draft prices (App Plans, Online Coaching, VIP) are a proposal / Stripe TEST
              only. There is no live checkout. Paid plans are additional to gym dues.
            </li>
            <li>Coach Savage AI is not Ricky. Weight-cut services are not sold here.</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/pricing" className="text-sm text-accent underline-offset-4 hover:underline">
              Read the draft pricing note
            </Link>
            <a
              href="https://www.svgandco.com/products"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Shop SVG &amp; CO
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
