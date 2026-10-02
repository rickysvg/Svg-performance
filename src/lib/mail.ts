import nodemailer from "nodemailer";

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult = {
  sent: boolean;
  reason: "not_configured" | "sent" | "send_failed";
};

type MailSender = (input: MailInput) => Promise<MailResult>;

const SMTP_TIMEOUT_MS = 10_000;

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim());
}

function smtpPort() {
  const parsed = Number(process.env.SMTP_PORT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML companion for the password-reset email. Text is still sent alongside it. */
export function passwordResetHtml(resetUrl: string) {
  const href = escapeHtml(resetUrl);
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <p style="margin:0 0 16px;font-weight:700;font-size:28px;letter-spacing:0.04em;text-transform:uppercase;">Reset your password</p>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.5;">We received a request to reset your SVG Performance password. This link expires in 1 hour.</p>
    <p style="margin:28px 0;">
      <a href="${href}" style="display:inline-block;background:#CBF805;color:#111111;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px;">Reset password</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;">If the button does not work, copy this link:</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;word-break:break-all;"><a href="${href}" style="color:#111111;">${href}</a></p>
    <p style="margin:0;font-size:14px;line-height:1.5;">If you didn't ask for this, you can ignore this email.</p>
  </div>
</body>
</html>`;
}

const REMINDER_DISPLAY_FONT =
  "Impact,'Arial Black',Helvetica,Arial,sans-serif";
const REMINDER_BODY_FONT = "Arial,Helvetica,sans-serif";

export type ReminderEmailItem = {
  label: string;
  message: string;
};

export type ReminderEmailCard = {
  eyebrow: string;
  brand: string;
  headline: string;
  intro: string;
  items: ReminderEmailItem[];
  ctaLabel: string;
  ctaHref: string;
  profileHref: string;
  footer: string;
  preheader: string;
};

function reminderItemRows(items: ReminderEmailItem[]) {
  return items
    .map((item, index) => {
      const gap = index === 0 ? "0" : "10px";
      return `<tr>
            <td style="padding:${gap} 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#111111" style="background-color:#111111;border-left:4px solid #CBF805;padding:12px 14px;">
                    <p style="margin:0 0 4px;font-family:${REMINDER_DISPLAY_FONT};font-size:12px;line-height:1.2;letter-spacing:0.14em;text-transform:uppercase;color:#CBF805;">${escapeHtml(item.label)}</p>
                    <p style="margin:0;font-family:${REMINDER_BODY_FONT};font-size:15px;line-height:1.45;color:#ffffff;">${escapeHtml(item.message)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
    })
    .join("");
}

/**
 * Branded HTML for SVG Performance reminder emails.
 * Black card, neon lime CTA. Email-safe fonts only (no web fonts).
 */
export function reminderEmailHtml(card: ReminderEmailCard) {
  const href = escapeHtml(card.ctaHref);
  const profileHref = escapeHtml(card.profileHref);
  const footer = escapeHtml(card.footer).replace(
    "Profile → Reminders",
    `<a href="${profileHref}" style="color:#CBF805;text-decoration:underline;">Profile → Reminders</a>`,
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(card.headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0a0a0a;opacity:0;">${escapeHtml(card.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="width:100%;max-width:520px;background-color:#000000;border:1px solid #2a2a2a;">
          <tr>
            <td height="8" bgcolor="#CBF805" style="height:8px;background-color:#CBF805;font-size:8px;line-height:8px;mso-line-height-rule:exactly;">&#8203;</td>
          </tr>
          <tr>
            <td style="padding:28px 24px 0;font-family:${REMINDER_DISPLAY_FONT};font-size:13px;line-height:1.2;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;color:#CBF805;">${escapeHtml(card.eyebrow)}</td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;font-family:${REMINDER_DISPLAY_FONT};font-size:12px;line-height:1.2;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:#ffffff;">${escapeHtml(card.brand)}</td>
          </tr>
          <tr>
            <td style="padding:12px 24px 0;font-family:${REMINDER_DISPLAY_FONT};font-size:32px;line-height:1;letter-spacing:0.01em;text-transform:uppercase;font-weight:700;color:#ffffff;">${escapeHtml(card.headline)}</td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;font-family:${REMINDER_BODY_FONT};font-size:15px;line-height:1.5;color:#f2f2f2;">${escapeHtml(card.intro)}</td>
          </tr>
          ${reminderItemRows(card.items)}
          <tr>
            <td style="padding:24px 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#CBF805" style="background-color:#CBF805;border-radius:999px;">
                    <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:${REMINDER_DISPLAY_FONT};font-size:16px;line-height:1;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;color:#111111;text-decoration:none;">${escapeHtml(card.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 0;font-family:${REMINDER_BODY_FONT};font-size:13px;line-height:1.5;color:#d0d0d0;">If the button does not open, use this link:<br /><a href="${href}" style="color:#CBF805;word-break:break-all;">${href}</a></td>
          </tr>
          <tr>
            <td style="padding:18px 24px 28px;font-family:${REMINDER_BODY_FONT};font-size:13px;line-height:1.5;color:#bdbdbd;">${footer}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function logSmtpFailure(error: unknown, secret: string) {
  let message = error instanceof Error ? error.message : "unknown error";
  if (secret && message.includes(secret)) {
    message = message.split(secret).join("[redacted]");
  }
  console.error("SMTP send failed:", message);
}

function recipientAccepted(accepted: unknown, to: string) {
  if (!Array.isArray(accepted)) return false;
  const target = to.trim().toLowerCase();
  return accepted.some((entry) => {
    const value = String(entry).trim().toLowerCase();
    return value === target || value.endsWith(`<${target}>`);
  });
}

async function defaultSendMail(input: MailInput): Promise<MailResult> {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  const host = process.env.SMTP_HOST!.trim();
  const port = smtpPort();
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.SMTP_FROM?.trim() || user || "noreply@localhost";

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (!recipientAccepted(info.accepted, input.to)) {
      console.error("SMTP send was not accepted for recipient");
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true, reason: "sent" };
  } catch (error) {
    logSmtpFailure(error, pass);
    return { sent: false, reason: "send_failed" };
  }
}

let sender: MailSender = defaultSendMail;

export function setMailSenderForTests(fn: MailSender | null) {
  sender = fn ?? defaultSendMail;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  try {
    return await sender(input);
  } catch (error) {
    logSmtpFailure(error, process.env.SMTP_PASS ?? "");
    return { sent: false, reason: "send_failed" };
  }
}
