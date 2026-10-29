import { redirect } from "next/navigation";

export default async function CalendarAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") next.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    }
  }
  const query = next.toString();
  redirect(query ? `/training/calendar?${query}` : "/training/calendar");
}
