/** Links stored below this generation were issued before the production leak fix. */
export const PASSWORD_RESET_GENERATION = 2;

export const PASSWORD_RESET_NEUTRAL_MESSAGE =
  "If an account exists, we'll email a link. Can't get in? Contact support.";

export const PASSWORD_RESET_RATE_MESSAGE =
  "Too many reset attempts. Wait a few minutes and try again.";

export const PASSWORD_RESET_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_MAX_PER_EMAIL = 5;
export const PASSWORD_RESET_MAX_PER_IP = 20;
