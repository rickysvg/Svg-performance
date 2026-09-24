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
import { HomeQuickActions } from "@/components/home/HomeQuickActions";
import { HomeMerchPromo } from "@/components/home/HomeMerchPromo";
import { SectionHeading } from "@/components/home/SectionHeading";

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
    <main className="space-y-8">
      <section className="-mx-4 -mt-6 bg-accent px-4 pb-8 pt-7 text-black">
        <p className="font-display text-sm font-medium uppercase tracking-[0.16em]">Let&apos;s go</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">
          Welcome {greetingName}
        </h1>
        <p className="mt-2 text-sm">
          SVG Performance · El Paso
          {profile?.goals ? ` · ${profile.goals}` : ""}
        </p>
        {!profile || !profileIsComplete(profile) ? (
          <p className="mt-4 text-sm">
            Finish your profile so Home can show a real goal and units.{" "}
            <Link href="/profile" className="font-semibold underline">
              Open profile
            </Link>
          </p>
        ) : null}
        {today.needsDeepPrompt ? (
          <p className="mt-3 text-sm">
            Optional 2-minute deeper profile.{" "}
            <Link href="/onboarding/deeper" className="font-semibold underline">
              Add details
            </Link>
          </p>
        ) : null}
      </section>

      {reminderResult.due.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-line bg-card px-4 py-4">
          {reminderResult.due.map((item) => (
            <p key={item.kind} className="text-sm text-muted">
              {item.message}
            </p>
          ))}
          <Link href="/profile" className="text-sm font-semibold underline">
            Reminder settings
          </Link>
        </section>
      ) : null}

      <HomeQuickActions />

      <TodayGuide guide={guide} />

      <DailyQuoteCard
        quote={quoteCard.quote}
        unlocked={quoteCard.unlocked}
        teaser={quoteCard.teaser}
      />

      <section className="space-y-4">
        <SectionHeading title="Nutrition today" href="/nutrition" action="Log food" className="pr-16" />
        <div className="rounded-[2rem] border border-line bg-card px-5 py-6">
          <NutritionRings
            calories={today.foodToday.calories}
            proteinG={today.foodToday.proteinG}
            carbsG={today.foodToday.carbsG}
            fatG={today.foodToday.fatG}
            targets={today.targets}
          />
        </div>
      </section>

      <HomeMerchPromo />

      <details className="rounded-2xl border border-line bg-card px-5 py-4 text-sm">
        <summary className="cursor-pointer font-semibold">
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
