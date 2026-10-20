import { requireAdmin } from "@/lib/roles";
import { AdminBack } from "@/components/admin/AdminChrome";
import { LessonForm } from "@/components/admin/LessonForm";

export default async function NewLessonPage() {
  await requireAdmin();
  return (
    <main className="space-y-6">
      <AdminBack href="/admin/lessons" label="Lessons" />
      <h1 className="text-2xl">New lesson draft</h1>
      <LessonForm />
    </main>
  );
}
