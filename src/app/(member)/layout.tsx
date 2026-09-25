import { Suspense } from "react";
import { MemberFrame } from "@/components/MemberFrame";
import { Celebration } from "@/components/celebration/Celebration";
import { requireOnboardedUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();
  const profile = await getProfileForUser(user.id);

  return (
    <>
      <MemberFrame email={user.email} role={user.role} timeZone={profile?.timeZone}>
        {children}
      </MemberFrame>
      <Suspense fallback={null}>
        <Celebration />
      </Suspense>
    </>
  );
}
