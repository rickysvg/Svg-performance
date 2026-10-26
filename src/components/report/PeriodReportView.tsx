import type { ReactNode } from "react";
import Link from "next/link";
import { CompareBars, SparringBars } from "@/components/report/CompareBars";
import { DeltaBadge } from "@/components/report/DeltaBadge";
import { REPORT_FOCUSES, reportHref, type PeriodReportModel } from "@/lib/report-history";

function chipClass(selected: boolean) {
  return selected
    ? "touch-target inline-flex shrink-0 items-center rounded-full border border-[#CBF805] bg-[#CBF805] px-3 text-sm text-black"
    : "touch-target inline-flex shrink-0 items-center rounded-full border border-white/15 px-3 text-sm text-[#f3f4ef]";
}

export function PeriodReportView({
  model,
  children,
}: {
  model: PeriodReportModel;
  children?: ReactNode;
}) {
  const focusHref = (focus: PeriodReportModel["focus"]) =>
    reportHref({
      kind: model.kind,
      key: model.key,
      currentKey: model.currentKey,
      focus,
      compareKey: model.baselineKey,
    });
  return (
    <main className="min-w-0 space-y-4" data-report-page data-report-kind={model.kind} data-report-key={model.key}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs uppercase tracking-wide text-[#CBF805]">Progress report</p>
          <h1 className="mt-1 text-2xl">{model.kind === "week" ? "Week" : "Month"}</h1>
        </div>
        <div className="flex shrink-0 rounded-full border border-white/15 p-1" role="group" aria-label="Report length">
          <Link href={model.weekHref} className={chipClass(model.kind === "week")} aria-current={model.kind === "week" ? "page" : undefined}>
            Week
          </Link>
          <Link href={model.monthHref} className={chipClass(model.kind === "month")} aria-current={model.kind === "month" ? "page" : undefined}>
            Month
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {model.prevHref ? (
          <Link href={model.prevHref} aria-label="Previous period" className="touch-target inline-flex items-center justify-center rounded-full border border-white/15 px-3 text-lg">
            ‹
          </Link>
        ) : (
          <span className="touch-target inline-flex items-center justify-center rounded-full border border-white/10 px-3 text-lg text-muted" aria-hidden>
            ‹
          </span>
        )}
        <div className="min-w-0 text-center">
          <p className="text-base font-semibold">{model.rangeLabel}</p>
          <p className="text-xs text-muted">vs {model.baselineLabel}</p>
        </div>
        {model.nextHref ? (
          <Link href={model.nextHref} aria-label="Next period" className="touch-target inline-flex items-center justify-center rounded-full border border-white/15 px-3 text-lg">
            ›
          </Link>
        ) : (
          <span className="touch-target inline-flex items-center justify-center rounded-full border border-white/10 px-3 text-lg text-muted" aria-hidden>
            ›
          </span>
        )}
      </div>

      <form method="get" action={model.formPath} className="flex items-end gap-2">
        {model.focus !== "all" ? <input type="hidden" name="focus" value={model.focus} /> : null}
        <label className="block min-w-0 flex-1 text-sm">
          Compare with
          <select
            name="compare"
            defaultValue={model.compareValue}
            className="mt-1 w-full rounded-xl border border-line bg-black px-3 py-3 text-sm"
          >
            {model.compareOptions.map((option) => (
              <option key={option.value || option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="touch-target rounded-full border border-[#CBF805] px-4 text-sm font-semibold text-[#CBF805]">
          Apply
        </button>
      </form>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Focus">
        {REPORT_FOCUSES.map((item) => (
          <Link
            key={item.id}
            href={focusHref(item.id)}
            role="tab"
            aria-selected={model.focus === item.id}
            className={chipClass(model.focus === item.id)}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {model.quiet ? (
        <section className="hc-panel hc-carbon px-4 py-5" data-report-quiet>
          <h2 className="text-lg">Quiet {model.kind}</h2>
          <p className="mt-2 text-sm text-muted">
            Nothing logged in this {model.kind} or the comparison. Counts stay empty until you log a session.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-2" data-report-metrics>
          {model.cards.map((card) => (
            <article key={card.id} className="min-w-0 rounded-2xl border border-[#cbf805]/25 bg-black/60 px-3 py-3" data-metric={card.id}>
              <p className="text-[11px] uppercase tracking-wide text-muted">{card.label}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="font-telemetry text-2xl leading-none text-[#CBF805]">{card.value}</span>
                <DeltaBadge card={card} />
              </p>
              {card.hint ? <p className="mt-1 text-[11px] leading-snug text-muted">{card.hint}</p> : null}
            </article>
          ))}
        </section>
      )}

      <div className="space-y-3">
        {model.charts.map((chart) => (
          <CompareBars key={chart.id} title={chart.title} description={chart.description} unit={chart.unit} points={chart.points} />
        ))}
      </div>

      {model.sparring ? (
        <section className="space-y-3" data-sparring-report>
          <div>
            <h2 className="text-lg">Sparring</h2>
            <p className="mt-1 text-sm text-muted">{model.sparring.note}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {model.sparring.cards.map((card) => (
              <article key={card.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/60 px-3 py-3" data-metric={card.id}>
                <p className="text-[11px] uppercase tracking-wide text-muted">{card.label}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="font-telemetry text-2xl leading-none text-[#CBF805]">{card.value}</span>
                  <DeltaBadge card={card} />
                </p>
                {card.hint ? <p className="mt-1 text-[11px] leading-snug text-muted">{card.hint}</p> : null}
              </article>
            ))}
          </div>
          <SparringBars title="Sparring rounds" description={model.sparring.note} points={model.sparring.points} />
        </section>
      ) : null}

      {children}

      <p className="text-sm">
        <Link href="/progress/weeks" className="text-[#CBF805] underline">
          All weeks
        </Link>
        {" · "}
        <Link href="/progress" className="text-[#CBF805] underline">
          Progress
        </Link>
      </p>
    </main>
  );
}
