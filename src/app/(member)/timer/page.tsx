import Link from "next/link";
import { RoundTimer } from "@/components/timer/RoundTimer";
import type { BagworkQuery } from "@/lib/bagwork";
import { resolveBagworkLaunch } from "@/lib/bagwork-store";
import { requireUser } from "@/lib/session";

export default async function TimerPage({
  searchParams,
}: {
  searchParams: Promise<BagworkQuery>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const launch = await resolveBagworkLaunch(user.id, query);
  return (
    <main>
      {query.bagwork && !launch ? (
        <p className="mb-4 text-sm">
          That bag workout is not on your list.{" "}
          <Link href="/bagwork" className="text-accent underline">
            Back to Bagwork
          </Link>
        </p>
      ) : null}
      <RoundTimer launch={launch} />
    </main>
  );
}
