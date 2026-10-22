import Link from "next/link";
import {
  PRICING_LADDER_COLUMNS,
  PRICING_LADDER_ROWS,
  type LadderCell,
} from "@/lib/pricing-ladder";
import type { VipPricingPhase } from "@/lib/vip-store";

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="mx-auto block text-[#CBF805]">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cell({ cell }: { cell: LadderCell }) {
  const label =
    cell.mark === "no" ? "Not included" : cell.note ? `Included: ${cell.note}` : "Included";
  return (
    <td
      className={`border-t border-white/10 px-0.5 py-2 text-center align-middle ${
        cell.adds ? "bg-[#CBF805]/15 ring-1 ring-inset ring-[#CBF805]" : ""
      }`}
      aria-label={label}
    >
      {cell.mark === "no" ? (
        <span aria-hidden className="text-sm text-white/35">
          —
        </span>
      ) : cell.note ? (
        <span className="block text-[10px] font-semibold leading-tight text-[#CBF805]">{cell.note}</span>
      ) : (
        <Check />
      )}
    </td>
  );
}

function LadderApply({
  phase,
  userLoggedIn,
}: {
  phase: VipPricingPhase;
  userLoggedIn: boolean;
}) {
  if (phase === "member") {
    return <p className="text-[10px] font-semibold leading-tight text-[#CBF805]">You&apos;re in</p>;
  }
  if (phase === "pending") {
    return <p className="text-[10px] leading-tight text-white/80">In review</p>;
  }
  const href =
    phase === "checkout" ? "/vip/checkout" : !userLoggedIn && phase === "apply" ? "/login" : "/vip/apply";
  const label = phase === "checkout" ? "Checkout" : phase === "waitlist" ? "Waitlist" : "Apply";
  return (
    <Link
      data-testid={`pricing-ladder-apply-${href.split("/").filter(Boolean).join("-")}`}
      href={href}
      data-ladder-apply
      className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full bg-[#CBF805] px-2 text-[11px] font-semibold text-black"
    >
      {label}
    </Link>
  );
}

export function PricingLadder({
  vipPhase,
  userLoggedIn,
}: {
  vipPhase: VipPricingPhase;
  userLoggedIn: boolean;
}) {
  return (
    <section data-pricing-ladder="1" aria-labelledby="pricing-ladder-title" className="text-white">
      <h2 id="pricing-ladder-title" className="font-display text-2xl text-foreground">
        Compare
      </h2>
      <p className="mt-1 text-xs text-muted">
        Lime check means included. A highlighted cell is what that step adds.
      </p>
      <div className="mt-3 rounded-2xl bg-black px-1.5 pb-2 pt-1">
        <table className="w-full table-fixed border-separate border-spacing-0 text-white">
          <caption className="sr-only">
            Academy member, SVG Pro, and VIP Coaching. Limited spots on VIP Coaching.
          </caption>
          <thead className="sticky top-14 z-10 bg-black">
            <tr>
              <th scope="col" className="w-[36%] bg-black p-1" />
              {PRICING_LADDER_COLUMNS.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  data-ladder-column={column.id}
                  className={`bg-black px-0.5 pb-2 pt-1 align-top ${
                    column.id === "vip" ? "rounded-t-xl ring-1 ring-inset ring-[#CBF805]" : ""
                  }`}
                >
                  <span className="block font-display text-[11px] uppercase leading-tight tracking-wide text-[#CBF805]">
                    {column.label}
                  </span>
                  {column.prices.map((line) => (
                    <span key={line} className="mt-0.5 block text-[10px] font-medium leading-tight text-white">
                      {line}
                    </span>
                  ))}
                  {column.id === "vip" ? (
                    <LadderApply phase={vipPhase} userLoggedIn={userLoggedIn} />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRICING_LADDER_ROWS.map((row) => (
              <tr key={row.id} data-ladder-row={row.id} className="border-t border-white/10">
                <th
                  scope="row"
                  className="border-t border-white/10 px-1 py-2 text-left text-[11px] font-medium leading-tight text-white"
                >
                  {row.label}
                </th>
                {PRICING_LADDER_COLUMNS.map((column) => (
                  <Cell key={column.id} cell={row.cells[column.id]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-1 pt-2 text-[10px] leading-snug text-white/70">
          AI coach chat free for your first week. Limited spots. VIP replies within 48 hours.
        </p>
      </div>
    </section>
  );
}
