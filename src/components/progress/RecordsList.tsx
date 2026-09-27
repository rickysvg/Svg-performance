import Link from "next/link";
import type { recordListFromBests } from "@/lib/personal-bests";

type Row = ReturnType<typeof recordListFromBests>[number] & { isNew?: boolean };

export function RecordsList({
  records,
  newExercise,
}: {
  records: Row[];
  newExercise?: string | null;
}) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted">
        Save a set with a load or a timed hold and it shows here.{" "}
        <Link href="/training" className="text-accent underline">
          Log a session
        </Link>
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {records.map((row) => {
        const isNew = Boolean(newExercise && row.exerciseName === newExercise);
        return (
          <li key={row.slug}>
            <Link
              href={`/progress/records/${row.slug}`}
              className={`flex items-center justify-between gap-3 py-4 ${
                isNew ? "rounded-xl bg-accent px-3 text-black" : ""
              }`}
            >
              <span>
                <span className="font-display text-sm uppercase tracking-wide">
                  {row.exerciseName}
                  {isNew ? (
                    <span className="ml-2 rounded-full bg-black px-2 py-0.5 text-[10px] text-highlighter">
                      New PR
                    </span>
                  ) : null}
                </span>
                <span className={`mt-1 block text-xs ${isNew ? "text-black/70" : "text-muted"}`}>
                  {row.kindLabel} · {row.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </span>
              <span className="font-display text-2xl uppercase tracking-wide">{row.headline}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
