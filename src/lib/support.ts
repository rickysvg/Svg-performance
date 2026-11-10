/**
 * Public support address for the app, not the gym front desk.
 * SMTP_FROM is only the From header on mail the app sends. It is not a contact address.
 * Set SUPPORT_EMAIL in production to the inbox that should receive member mail.
 */
export const SUPPORT_EMAIL_FALLBACK = "support@svg-performance.app";

export function supportEmail() {
  const configured = process.env.SUPPORT_EMAIL?.trim();
  return configured || SUPPORT_EMAIL_FALLBACK;
}
