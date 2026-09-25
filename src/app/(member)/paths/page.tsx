import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ensureDefaultPath, listPaths, getPathProgress } from "@/lib/paths";
import { EnrollPathForm } from "@/components/paths/EnrollPathForm";
import { DemoBadge } from "@/components/DemoBadge";

export default async function PathsPage() {
  const user = await requireUser();
  const active = await ensureDefaultPath(user.id);
  const [paths, progress] = await Promise.all([
    listPaths(),
    getPathProgress(user.id),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Training paths</h1>
          <p className="mt-1 text-sm text-muted">
            DEMO tracks with milestones. Default comes from your intake. Today pulls the next step.
          </p>
        </div>
        <DemoBadge />
      </div>

      {paths.map((path) => {
        const current = path.slug === active.pathSlug;
        return (
          <article key={path.slug} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">{path.title}</h2>
                <p className="mt-1 text-sm text-muted">{path.summary}</p>
                <p className="mt-2 text-xs text-muted">{path.steps.length} milestones</p>
              </div>
              {current ? (
                <span className="text-xs font-semibold text-accent">Active</span>
              ) : null}
            </div>
            {current ? (
              <p className="mt-3 text-sm">
                {progress.nextStep
                  ? `Next: ${progress.nextStep.title}`
                  : "All DEMO milestones on this path are complete."}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col items-start gap-3">
              <Link href={`/paths/${path.slug}`} className="text-sm text-accent underline">
                View milestones
              </Link>
              {!current ? <EnrollPathForm pathSlug={path.slug} label="Make this my path" /> : null}
            </div>
          </article>
        );
      })}
    </main>
  );
}
