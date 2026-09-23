import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, profileIsComplete } from "@/lib/profile";
import { emptyHomeToday, getHomeToday, homeLoad, parseDayParam } from "@/lib/home";
import { processDueRemindersForUser } from "@/lib/reminders";
import { listHelpRequestsForMember } from "@/lib/help";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";
import { NutritionRings } from "@/components/home/NutritionRings";
import { DAILY_QUOTES, getDailyQuoteCard, teaserFromQuote } from "@/lib/quotes";
import { DailyQuoteCard } from "@/components/quotes/DailyQuoteCard";
import { emptyTodayGuide, getTodayGuide } from "@/lib/today";
import { TodayGuide } from "@/components/home/TodayGuide";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const selected = parseDayParam(params.day);
  const fallbackQuote = DAILY_QUOTES[0];
  const [profile, today, reminderResult, helpRequests, quoteCard, guide] = await Promise.all([
    homeLoad("profile", getProfileForUser(user.id), null),
    homeLoad("today", getHomeToday(user.id, selected), emptyHomeToday(selected)),
    homeLoad(
      "reminders",
      processDueRemindersForUser(user.id, user.email),
      { due: [], emailed: false, smtpConfigured: false },
    ),
    homeLoad("help", listHelpRequestsForMember(user.id), []),
    homeLoad("quote", getDailyQuoteCard(user.id), {
      quote: fallbackQuote,
      unlocked: false,
      teaser: teaserFromQuote(fallbackQuote),
    }),
    homeLoad("guide", getTodayGuide(user.id, selected), emptyTodayGuide(selected)),
  ]);
  const greetingName = today.firstName || "athlete";
  const openHelp = helpRequests.filter((row) => row.status === "open");

  return (
    <main className="space-y-10">
      <div>
        <p className="text-sm text-muted">Let&apos;s go,</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">{greetingName}</h1>
        {profile?.goals ? (
          <p className="mt-2 text-sm text-muted">{profile.goals}</p>
        ) : null}
      </div>

      {!profile || !profileIsComplete(profile) ? (
        <p className="text-sm text-muted">
          Finish your profile so Home can show a real goal and units.{" "}
          <Link href="/profile" className="font-semibold text-accent">
            Open profile
          </Link>
        </p>
      ) : null}

      {today.needsDeepPrompt ? (
        <p className="text-sm text-muted">
          Optional 2-minute deeper profile.{" "}
          <Link href="/onboarding/deeper" className="font-semibold text-accent">
            Add details
          </Link>
        </p>
      ) : null}

      {reminderResult.due.length > 0 ? (
        <section className="space-y-2">
          {reminderResult.due.map((item) => (
            <p key={item.kind} className="text-sm text-muted">
              {item.message}
            </p>
          ))}
          <Link href="/profile" className="text-sm text-accent">
            Reminder settings
          </Link>
        </section>
      ) : null}

      <DailyQuoteCard
        quote={quoteCard.quote}
        unlocked={quoteCard.unlocked}
        teaser={quoteCard.teaser}
      />

      <TodayGuide guide={guide} />

      <section className="rounded-2xl border border-line bg-card px-5 py-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Nutrition today</h2>
          <Link href="/nutrition" className="text-sm font-semibold text-accent">
            Log food
          </Link>
        </div>
        <div className="mt-5">
          <NutritionRings
            calories={today.foodToday.calories}
            proteinG={today.foodToday.proteinG}
            carbsG={today.foodToday.carbsG}
            fatG={today.foodToday.fatG}
            targets={today.targets}
          />
        </div>
      </section>

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="More">
        <Link href="/training/calendar" className="hover:text-foreground">
          Calendar
        </Link>
        <Link href="/progress" className="hover:text-foreground">
          Progress
        </Link>
      </nav>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">
          Ask a coach
          {openHelp.length > 0 ? ` · ${openHelp.length} open` : ""}
        </summary>
        <p className="mt-3 text-muted">
          A request with a real status (open, seen, closed). Not a 24/7 chat.
        </p>
        <div className="mt-4">
          <HelpRequestForm />
        </div>
      </details>
    </main>
  );
}
