import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { QuickAddFab } from "@/components/home/QuickAddFab";
import { requireOnboardedUser } from "@/lib/session";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email} role={user.role} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 pb-24">
        {children}
      </div>
      <QuickAddFab />
      <BottomNav />
    </div>
  );
}
