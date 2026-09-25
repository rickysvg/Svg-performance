import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { LessonForm } from "@/components/admin/LessonForm";

export default async function NewLessonPage() {
  await requireAdmin();
  return (
    <main className="space-y-6">
      <Link href="/admin/lessons" className="text-sm text-accent underline">
        Back
      </Link>
      <h1 className="text-2xl">New lesson draft</h1>
      <LessonForm />
    </main>
  );
}
