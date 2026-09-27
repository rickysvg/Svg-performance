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
