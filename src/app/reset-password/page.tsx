import { AppHeader } from "@/components/AppHeader";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <ResetPasswordForm token={token ?? ""} />
      </main>
    </div>
  );
}
