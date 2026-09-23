export const PRIMARY_NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/training", label: "Train" },
  { href: "/nutrition", label: "Fuel" },
  { href: "/learn", label: "Learn" },
  { href: "/coach", label: "Coach" },
] as const;

export type PrimaryNavHref = (typeof PRIMARY_NAV_LINKS)[number]["href"];

export function isPrimaryNavActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAccountNavActive(pathname: string, href: string) {
  if (href === "/staff/reports") {
    return pathname === "/staff" || pathname.startsWith("/staff/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
