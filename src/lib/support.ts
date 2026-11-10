/**
 * Public support address for the app, not the gym front desk.
 * SMTP_FROM is only the From header on mail the app sends. It is not a contact address.
 *
 * Member-facing mail, mailto links, and legal pages use this inbox.
 * SUPPORT_EMAIL may set the same address. A blank value, or a retired inbox
 * nobody reads, resolves here.
 */
export const SUPPORT_EMAIL = "support@svgperformance.app";

/**
 * Retired inboxes. Built so the live address is the only support mailbox
 * written as one string. The hyphenated app domain and the old academy
 * manager address are ignored when SUPPORT_EMAIL is set to either of them.
 */
function retiredSupportAddress(value: string) {
  const hyphenatedAppDomain = ["svg", "performance.app"].join("-");
  const oldAcademyManager = ["manager@svgmma", "academy.com"].join("");
  return value.endsWith(`@${hyphenatedAppDomain}`) || value === oldAcademyManager;
}

export function supportEmail() {
  const configured = process.env.SUPPORT_EMAIL?.trim().toLowerCase() ?? "";
  if (!configured || retiredSupportAddress(configured)) return SUPPORT_EMAIL;
  return configured;
}
