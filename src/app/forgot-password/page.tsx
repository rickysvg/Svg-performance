import { AppHeader } from "@/components/AppHeader";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Reset password</h1>
        <p className="mt-2 text-sm text-muted">
          Email delivery is not wired in this preview. After you submit, the
          app can show a one-time reset link on this page.
        </p>
        <ForgotPasswordForm />
      </main>
    </div>
  );
}
