import { AppHeader } from "@/components/AppHeader";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { PASSWORD_RESET_NEUTRAL_MESSAGE } from "@/lib/password-reset-policy";

export const runtime = "nodejs";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Reset password</h1>
        <p className="mt-2 text-sm text-muted">{PASSWORD_RESET_NEUTRAL_MESSAGE}</p>
        <ForgotPasswordForm />
      </main>
    </div>
  );
}
