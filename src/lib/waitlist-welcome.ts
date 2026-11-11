import { REMINDER_LOGO_URL, sendMail } from "@/lib/mail";
import { supportEmail } from "@/lib/support";

export const WAITLIST_WELCOME_SUBJECT = "You're in. Stay ready.";
export const WAITLIST_WELCOME_PREHEADER =
  "We'll email you the moment doors open. Here's what you can expect.";
export const WAITLIST_WELCOME_ADDRESS = "2131 Texas Ave, El Paso, TX";
export const WAITLIST_WELCOME_APP_URL = "https://svgperformance.app";
export const WAITLIST_WELCOME_REASON =
  "You're getting this because you joined the SVG Performance waitlist. Reply to this email to unsubscribe.";

const DISPLAY_FONT = "Anton, Impact, 'Arial Black', Helvetica, Arial, sans-serif";
const BODY_FONT = "Arial, Helvetica, sans-serif";
const PRIVACY_URL = `${WAITLIST_WELCOME_APP_URL}/privacy`;

const EXPECTATIONS = [
  {
    title: "Strength that serves the fight",
    body: "Fight-specific strength and conditioning blocks that change every 3 weeks.",
  },
  {
    title: "Bag rounds and shadowboxing",
    body: "Every round has a job. No more three minutes of whatever comes to mind.",
  },
  {
    title: "Mobility",
    body: "Stay loose and ready to train.",
  },
  {
    title: "Logger with RIR",
    body: "A between-sets workout logger with RIR guidance, built for the gym.",
  },
  {
    title: "Short form videos",
    body: "Watch the clip, then get back to work.",
  },
  {
    title: "Progress tracking",
    body: "Your numbers, saved and charted from your own work.",
  },
  {
    title: "Plans tuned to your level",
    body: "The work fits where you are.",
  },
] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanFirstName(firstName: string) {
  let out = "";
  for (const char of firstName) {
    out += char.charCodeAt(0) < 32 ? " " : char;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** "Hey Ricky," or "Hey fighter," when the signup has no first name. */
export function waitlistWelcomeGreeting(firstName: string) {
  const name = cleanFirstName(firstName);
  return name ? `Hey ${name},` : "Hey fighter,";
}

function expectationHtml() {
  return EXPECTATIONS.map((item, index) => {
    const padding = index === 0 ? "14px" : "10px";
    return `          <tr>
            <td class="px" style="padding:${padding} 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="item" bgcolor="#121418" style="background-color:#121418;border-left:4px solid #CBF805;padding:14px 16px;">
                    <p class="display lime" style="margin:0 0 4px;font-family:${DISPLAY_FONT};font-size:13px;line-height:1.2;letter-spacing:0.10em;text-transform:uppercase;font-weight:400;color:#CBF805;">${escapeHtml(item.title)}</p>
                    <p class="text" style="margin:0;font-family:${BODY_FONT};font-size:15px;line-height:1.45;color:#f3f4ef;">${escapeHtml(item.body)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }).join("\n");
}

function welcomeHtml(greetingHtml: string, support: string) {
  const safeSupport = escapeHtml(support);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(WAITLIST_WELCOME_SUBJECT)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&amp;display=swap" />
  <style type="text/css">
    @import url("https://fonts.googleapis.com/css2?family=Anton&display=swap");
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
    body { background-color: #07080a; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a { text-decoration: none; }
    a[x-apple-data-detectors],
    #MessageViewBody a { color: inherit !important; text-decoration: none !important; }
    /* Anton ships only weight 400. Never faux-bold headings. */
    .display {
      font-family: Anton, Impact, "Arial Black", Helvetica, Arial, sans-serif !important;
      font-weight: 400 !important;
      font-synthesis: none;
      -webkit-font-smoothing: antialiased;
    }
    @media only screen and (max-width: 620px) {
      .email-wrap { width: 100% !important; max-width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-title { font-size: 36px !important; line-height: 1.02 !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .outer, .card, .item, .footer-bg {
        background-color: #07080a !important;
        background: #07080a !important;
      }
      .card { background-color: #000000 !important; background: #000000 !important; }
      .item { background-color: #121418 !important; background: #121418 !important; }
      .bar { background-color: #CBF805 !important; background: #CBF805 !important; }
      .text, .body-text { color: #f3f4ef !important; }
      .muted { color: #9aa394 !important; }
      .lime, .eyebrow { color: #CBF805 !important; }
      .btn { background-color: #CBF805 !important; background: #CBF805 !important; }
      .btn a, .btn-text { color: #14180a !important; }
      .rule { border-color: #2a3124 !important; }
    }
    [data-ogsc] body, [data-ogsc] .outer { background-color: #07080a !important; }
    [data-ogsc] .card { background-color: #000000 !important; }
    [data-ogsc] .item { background-color: #121418 !important; }
    [data-ogsc] .bar, [data-ogsc] .btn { background-color: #CBF805 !important; }
    [data-ogsc] .text, [data-ogsc] .body-text { color: #f3f4ef !important; }
    [data-ogsc] .lime, [data-ogsc] .eyebrow { color: #CBF805 !important; }
    [data-ogsc] .btn a, [data-ogsc] .btn-text { color: #14180a !important; }
  </style>
</head>
<body class="outer" style="margin:0;padding:0;background-color:#07080a;width:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#07080a;opacity:0;">
    ${escapeHtml(WAITLIST_WELCOME_PREHEADER)}&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="outer" bgcolor="#07080a" style="background-color:#07080a;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td>
        <![endif]-->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-wrap card" bgcolor="#000000" style="width:100%;max-width:600px;background-color:#000000;border:1px solid #2a3124;">
          <tr>
            <td class="bar" height="8" bgcolor="#CBF805" style="height:8px;background-color:#CBF805;font-size:8px;line-height:8px;mso-line-height-rule:exactly;">&#8203;</td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 0;">
              <a href="${WAITLIST_WELCOME_APP_URL}" style="text-decoration:none;">
                <img src="${REMINDER_LOGO_URL}" width="180" height="180" alt="SVG Performance" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:180px;" />
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" class="display eyebrow px" style="padding:20px 32px 0;font-family:${DISPLAY_FONT};font-size:13px;line-height:1.2;letter-spacing:0.16em;text-transform:uppercase;font-weight:400;color:#CBF805;">
              Built at SVG MMA Academy
            </td>
          </tr>
          <tr>
            <td align="center" class="display hero-title text px" style="padding:10px 32px 0;font-family:${DISPLAY_FONT};font-size:44px;line-height:1.02;letter-spacing:0.02em;text-transform:uppercase;font-weight:400;color:#ffffff;">
              You're in.<br />Stay ready.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="bar" height="3" width="72" bgcolor="#CBF805" style="height:3px;width:72px;background-color:#CBF805;font-size:3px;line-height:3px;mso-line-height-rule:exactly;">&#8203;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:28px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              ${greetingHtml}
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:16px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              You're on the SVG Performance waitlist, so you'll hear first when we go live. We'll email you the moment doors open.
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:16px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              I built this because too many fighters train hard with no plan. Random lifts. Random rounds. Nothing written down. The work should fit the fight, and the week you actually have.
            </td>
          </tr>
          <tr>
            <td align="left" class="display lime px" style="padding:28px 32px 0;font-family:${DISPLAY_FONT};font-size:18px;line-height:1.15;letter-spacing:0.06em;text-transform:uppercase;font-weight:400;color:#CBF805;">
              Here's what you can expect
            </td>
          </tr>
${expectationHtml()}
          <tr>
            <td class="body-text px" style="padding:28px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              Train on the web. Open it on your phone, no download needed.
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:8px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              iPhone and Android apps are on the way.
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding:28px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td class="btn" align="center" bgcolor="#CBF805" style="background-color:#CBF805;border-radius:999px;">
                    <a class="btn-text display" href="${WAITLIST_WELCOME_APP_URL}" style="display:inline-block;padding:16px 32px;font-family:${DISPLAY_FONT};font-size:18px;line-height:1;letter-spacing:0.08em;text-transform:uppercase;font-weight:400;color:#14180a;text-decoration:none;">See the app</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="muted px" style="padding:18px 32px 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:#9aa394;">
              If the button does not open, use this link:<br />
              <a href="${WAITLIST_WELCOME_APP_URL}" style="color:#CBF805;text-decoration:underline;word-break:break-all;">${WAITLIST_WELCOME_APP_URL}</a>
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:24px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              Questions? Write us at <a href="mailto:${safeSupport}" style="color:#CBF805;text-decoration:underline;">${safeSupport}</a>.
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:24px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              Go train.
            </td>
          </tr>
          <tr>
            <td class="body-text px" style="padding:8px 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              Coach Ricky<br />
              <span class="muted" style="color:#9aa394;font-size:13px;">(the real one, Ricky Maynez, SVG MMA Academy)</span>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:28px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="rule" height="1" bgcolor="#2a3124" style="height:1px;background-color:#2a3124;border-top:1px solid #2a3124;font-size:1px;line-height:1px;">&#8203;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="muted footer-bg px" style="padding:18px 32px 28px;font-family:${BODY_FONT};font-size:12px;line-height:1.55;color:#9aa394;">
              ${escapeHtml(WAITLIST_WELCOME_REASON)}<br />
              <a href="mailto:${safeSupport}" style="color:#CBF805;text-decoration:underline;">${safeSupport}</a><br />
              ${escapeHtml(WAITLIST_WELCOME_ADDRESS)}<br />
              <a href="${PRIVACY_URL}" style="color:#CBF805;text-decoration:underline;">Privacy</a>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomeText(greeting: string, support: string) {
  const cards = EXPECTATIONS.map((item) => `${item.title}\n${item.body}`).join("\n\n");
  return [
    greeting,
    "",
    "You're on the SVG Performance waitlist, so you'll hear first when we go live. We'll email you the moment doors open.",
    "",
    "I built this because too many fighters train hard with no plan. Random lifts. Random rounds. Nothing written down. The work should fit the fight, and the week you actually have.",
    "",
    "Here's what you can expect",
    "",
    cards,
    "",
    "Train on the web. Open it on your phone, no download needed.",
    "",
    "iPhone and Android apps are on the way.",
    "",
    "See the app",
    WAITLIST_WELCOME_APP_URL,
    "",
    `Questions? Write us at ${support}.`,
    "",
    "Go train.",
    "",
    "Coach Ricky",
    "(the real one, Ricky Maynez, SVG MMA Academy)",
    "",
    WAITLIST_WELCOME_REASON,
    support,
    WAITLIST_WELCOME_ADDRESS,
    `Privacy: ${PRIVACY_URL}`,
  ].join("\n");
}

export function buildWaitlistWelcomeEmail(firstName: string) {
  const greeting = waitlistWelcomeGreeting(firstName);
  const name = cleanFirstName(firstName);
  const greetingHtml = name ? `Hey ${escapeHtml(name)},` : "Hey fighter,";
  const replyTo = supportEmail();
  return {
    subject: WAITLIST_WELCOME_SUBJECT,
    preheader: WAITLIST_WELCOME_PREHEADER,
    text: welcomeText(greeting, replyTo),
    html: welcomeHtml(greetingHtml, replyTo),
    replyTo,
  };
}

/**
 * Welcome mail for a new waitlist signup. Uses the same SMTP helper as
 * password reset and reminders. A send failure is logged and swallowed.
 */
export async function sendWaitlistWelcomeEmail(input: { to: string; firstName: string }) {
  try {
    const mail = buildWaitlistWelcomeEmail(input.firstName);
    const result = await sendMail({
      to: input.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
    if (result.reason === "send_failed") {
      console.error("waitlist welcome email failed");
    }
    return result;
  } catch {
    console.error("waitlist welcome email failed");
    return { sent: false, reason: "send_failed" as const };
  }
}
