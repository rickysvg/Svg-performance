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
          Adults (18+) only. Open to combat athletes, people getting in shape,
          and SVG MMA Academy members. Checking “I train at SVG” does not
          unlock member pricing — an admin verifies that separately.
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
