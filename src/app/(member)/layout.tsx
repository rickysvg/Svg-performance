import { Suspense } from "react";
import { MemberFrame } from "@/components/MemberFrame";
import { Celebration } from "@/components/celebration/Celebration";
import { requireOnboardedUser } from "@/lib/session";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();

  return (
    <>
      <MemberFrame email={user.email} role={user.role}>
        {children}
      </MemberFrame>
      <Suspense fallback={null}>
        <Celebration />
      </Suspense>
    </>
  );
}
