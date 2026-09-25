import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/roles";
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
      <Link href="/admin/lessons" className="text-sm text-accent underline">
        Back
      </Link>
      <h1 className="text-2xl">Edit lesson</h1>
      <LessonForm lesson={lesson} />
    </main>
  );
}
