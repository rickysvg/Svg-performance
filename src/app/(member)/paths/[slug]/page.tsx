import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getPathBySlug, getPathProgress, isPathSlug } from "@/lib/paths";
import { CompleteStepForm } from "@/components/paths/CompleteStepForm";
import { EnrollPathForm } from "@/components/paths/EnrollPathForm";
import { DemoBadge } from "@/components/DemoBadge";
import { EmptyState } from "@/components/EmptyState";

export default async function PathDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  if (!isPathSlug(slug)) {
    notFound();
  }
  const catalog = getPathBySlug(slug);
  if (!catalog) {
    notFound();
  }
  const progress = await getPathProgress(user.id, slug);
  const enrolled = progress.enrollmentSlug === slug;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/paths" className="text-sm text-accent underline">
          All paths
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">{catalog.title}</h1>
            <p className="mt-1 text-sm text-muted">{catalog.summary}</p>
          </div>
          <DemoBadge />
        </div>
      </div>

      {!enrolled ? (
        <EmptyState
          title="Not your active path"
          action={<EnrollPathForm pathSlug={slug} label="Enroll in this path" />}
        >
          You can still read the milestones. Enroll to have Today use this track.
        </EmptyState>
      ) : null}

      <ol className="space-y-3">
        {catalog.steps.map((step, index) => {
          const done = progress.doneKeys.includes(step.key);
          const next = progress.nextStep?.key === step.key;
          return (
            <li key={step.key} className="rounded-2xl border border-line bg-card p-5">
              <p className="text-xs uppercase text-muted">
                Step {index + 1}
                {done ? " · done" : next ? " · next" : ""}
              </p>
              <h2 className="mt-1">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.summary}</p>
              <Link href={step.href} className="mt-3 inline-block text-sm text-accent underline">
                Open
              </Link>
              {enrolled && !done ? (
                <CompleteStepForm pathSlug={slug} stepKey={step.key} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
