import { requireDashboardAdmin } from "@/lib/admin-access";
import { isSmtpConfigured } from "@/lib/mail";
import { vapidConfig } from "@/lib/weekly-checkin-push";
import { AdminScreen } from "@/components/admin/AdminChrome";
import { AnnouncementComposer } from "@/components/admin/AnnouncementComposer";

export default async function AdminAnnouncementsPage() {
  await requireDashboardAdmin();
  const emailReady = isSmtpConfigured();
  const pushReady = vapidConfig().configured;

  return (
    <AdminScreen
      kicker="Draft"
      title="Announce"
      hint="Write it, review it, then confirm. Nothing sends on the first tap."
    >
      {!emailReady && !pushReady ? (
        <p className="rounded-2xl border border-[#FF3B3B]/40 px-4 py-3 text-sm text-white/80">
          Push and email are not set up. You can still draft. Send stays off until one of them is ready.
        </p>
      ) : null}
      <AnnouncementComposer emailReady={emailReady} pushReady={pushReady} />
    </AdminScreen>
  );
}
