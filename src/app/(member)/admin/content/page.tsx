import Link from "next/link";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { getContentDesk } from "@/lib/admin-dashboard";
import { AdminScreen, AdminToolkit } from "@/components/admin/AdminChrome";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { ReseedCatalogButton } from "@/components/admin/ReseedCatalogButton";
import { deskSurfaceClass } from "@/lib/admin-desk-status";

export default async function AdminContentPage() {
  const user = await requireDashboardAdmin();
  const content = await getContentDesk();
  const toolkit =
    user.role === "admin"
      ? [
          { href: "/admin/lessons", label: "Lessons", hint: "Drafts and publish" },
          { href: "/admin/focus", label: "Weekly focus", hint: "60–90 second video" },
          { href: "/admin/challenges", label: "Monthly challenge", hint: "Days active" },
        ]
      : [];

  return (
    <AdminScreen
      kicker="Library"
      title="Content"
      hint="Form videos still waiting, then the catalog refresh."
    >
      <section className="space-y-2">
        <h2 className="text-lg">Form videos pending</h2>
        {content.formVideos.length === 0 ? (
          <p className="text-sm text-muted">No form videos waiting on a clip.</p>
        ) : (
          <ul className="space-y-2">
            {content.formVideos.map((name) => (
              <li
                key={name}
                data-desk-tone="attention"
                className={`hc-panel flex items-center justify-between gap-3 px-4 py-3 ${deskSurfaceClass("attention")}`}
              >
                <span>{name}</span>
                <DeskBadge tone="attention" label="Pending" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {content.lessons.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Lessons without a video</h2>
          <ul className="space-y-2">
            {content.lessons.map((lesson) => (
              <li
                key={lesson.id}
                data-desk-tone="attention"
                className={`hc-panel px-4 py-3 ${deskSurfaceClass("attention")}`}
              >
                {user.role === "admin" ? (
                  <Link href={`/admin/lessons/${lesson.id}`}>
                    <span className="block font-semibold">{lesson.title}</span>
                    <span className="text-sm text-muted">{lesson.status}</span>
                  </Link>
                ) : (
                  <>
                    <span className="block font-semibold">{lesson.title}</span>
                    <span className="text-sm text-muted">{lesson.status}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="hc-panel space-y-3 px-4 py-4">
        <h2 className="text-lg">Exercise catalog</h2>
        <ReseedCatalogButton />
      </section>
      <AdminToolkit links={toolkit} />
    </AdminScreen>
  );
}
