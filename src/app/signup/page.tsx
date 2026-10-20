import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/home");
  redirect("/register");
}
