import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Create a preview account</h1>
        <p className="mt-2 text-sm text-muted">
          Adults only. Checking “I am a gym member” does not grant a discount
          or extra access. Membership is verified separately by an admin later.
        </p>
        <RegisterForm />
        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
