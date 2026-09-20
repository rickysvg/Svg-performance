import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/session";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
