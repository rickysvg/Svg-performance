import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/roles";
import { AdminBack } from "@/components/admin/AdminChrome";
import { getLessonForAdmin } from "@/lib/lessons";
import { LessonForm } from "@/components/admin/LessonForm";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  await requireAdmin();
  const { lessonId } = await params;
  let lesson;
  try {
    lesson = await getLessonForAdmin(lessonId);
  } catch {
    notFound();
  }
  return (
    <main className="space-y-6">
      <AdminBack href="/admin/lessons" label="Lessons" />
      <h1 className="text-2xl">Edit lesson</h1>
      <LessonForm lesson={lesson} />
    </main>
  );
}
