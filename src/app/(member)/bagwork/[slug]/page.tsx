import { notFound } from "next/navigation";
import { BagWorkoutDetail } from "@/components/bagwork/BagWorkoutDetail";
import { bagWorkoutBySlug, viewFromCatalog } from "@/lib/bagwork";
import { requireUser } from "@/lib/session";

export default async function BagWorkoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const workout = bagWorkoutBySlug(slug);
  if (!workout) notFound();
  return <BagWorkoutDetail view={viewFromCatalog(workout)} />;
}
