import { REMINDER_LOGO_URL, sendMail } from "@/lib/mail";
import { supportEmail } from "@/lib/support";
import {
  escapeHtml,
  WAITLIST_PREHEADER_PAD,
  WAITLIST_WELCOME_ADDRESS,
  WAITLIST_WELCOME_APP_URL,
  WAITLIST_WELCOME_REASON,
  waitlistWelcomeGreeting,
  waitlistWelcomeGreetingHtml,
} from "@/lib/waitlist-welcome";

export const WAITLIST_LIVE_SUBJECT = "We're live. Get to work.";
export const WAITLIST_LIVE_PREHEADER = "You waited. You're first. Let's work.";

const DISPLAY_FONT = "Anton, Impact, 'Arial Black', Helvetica, Arial, sans-serif";
const BODY_FONT = "Arial, Helvetica, sans-serif";

const LIVE_UTM = "utm_source=waitlist&utm_medium=email&utm_campaign=launch_nov16";

export const WAITLIST_LIVE_CTA_URL = `${WAITLIST_WELCOME_APP_URL}/login?${LIVE_UTM}&utm_content=live_cta`;
export const WAITLIST_LIVE_LINK_URL = `${WAITLIST_WELCOME_APP_URL}/login?${LIVE_UTM}&utm_content=live_link`;
export const WAITLIST_LIVE_LOGO_URL = `${WAITLIST_WELCOME_APP_URL}?${LIVE_UTM}&utm_content=live_logo`;
export const WAITLIST_LIVE_PRIVACY_URL = `${WAITLIST_WELCOME_APP_URL}/privacy?${LIVE_UTM}&utm_content=live_privacy`;
export const WAITLIST_LIVE_LOGIN_LABEL = `${WAITLIST_WELCOME_APP_URL}/login`;

const INSIDE = [
  {
    title: "Training plans built for fighters",
    body: "Fight-specific strength and conditioning. The work fits the fight.",
  },
  {
    title: "Logger with a rest timer",
    body: "A between-sets logger with a rest timer, built for the gym.",
  },
  {
    title: "AI coach",
    body: "A coach in your corner when you need a read on the work.",
  },
  {
    title: "Mobility",
    body: "Stay loose and ready to train.",
  },
  {
    title: "Calendar",
    body: "Set your training days. Move a session when the week changes.",
  },
] as const;

const STEPS = [
  {
    title: "01 Create your account",
    body: "Open svgperformance.app and sign up.",
  },
  {
    title: "02 Set your days",
    body: "Tell it when you train and spar. Your week stays around mat time.",
  },
  {
    title: "03 Start the work",
    body: "Open today's session, start the timer, and log what you did.",
  },
] as const;

const DOORS =
  "Doors are open. You signed up early, so you're hearing it first. SVG Performance is live on the web now.";
const WORK =
  "The work is built for the fight, and for the week you actually have. Open it, set your days, and get after it.";
const WEB_LINE = "Train on the web. Open it on your phone, no download needed.";
const APPS_LINE = "iPhone and Android apps are on the way. We'll email you when they're ready.";

function cardRows(items: readonly { title: string; body: string }[]) {
  return items
    .map((item, index) => {
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
    })
    .join("\n");
}

function sectionHead(label: string) {
  return `          <tr>
            <td align="left" class="display lime px" style="padding:28px 32px 0;font-family:${DISPLAY_FONT};font-size:18px;line-height:1.15;letter-spacing:0.06em;text-transform:uppercase;font-weight:400;color:#CBF805;">
              ${escapeHtml(label)}
            </td>
          </tr>`;
}

function bodyRow(html: string, paddingTop: string) {
  return `          <tr>
            <td class="body-text px" style="padding:${paddingTop} 32px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#f3f4ef;">
              ${html}
            </td>
          </tr>`;
}

function liveHtml(greetingHtml: string, support: string) {
  const safeSupport = escapeHtml(support);
  const cta = escapeHtml(WAITLIST_LIVE_CTA_URL);
  const link = escapeHtml(WAITLIST_LIVE_LINK_URL);
  const logo = escapeHtml(WAITLIST_LIVE_LOGO_URL);
  const privacy = escapeHtml(WAITLIST_LIVE_PRIVACY_URL);
  const loginLabel = escapeHtml(WAITLIST_LIVE_LOGIN_LABEL);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(WAITLIST_LIVE_SUBJECT)}</title>
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
    ${escapeHtml(WAITLIST_LIVE_PREHEADER)}${WAITLIST_PREHEADER_PAD}
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
              <a href="${logo}" style="text-decoration:none;">
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
              We're live.<br />Get to work.
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
${bodyRow(greetingHtml, "28px")}
${bodyRow(escapeHtml(DOORS), "16px")}
${bodyRow(escapeHtml(WORK), "16px")}
${sectionHead("What's inside")}
${cardRows(INSIDE)}
${sectionHead("How to get started")}
${cardRows(STEPS)}
${bodyRow(escapeHtml(WEB_LINE), "28px")}
${bodyRow(escapeHtml(APPS_LINE), "8px")}
          <tr>
            <td align="center" class="px" style="padding:28px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td class="btn" align="center" bgcolor="#CBF805" style="background-color:#CBF805;border-radius:999px;">
                    <a class="btn-text display" href="${cta}" style="display:inline-block;padding:16px 32px;font-family:${DISPLAY_FONT};font-size:18px;line-height:1;letter-spacing:0.08em;text-transform:uppercase;font-weight:400;color:#14180a;text-decoration:none;">Start training</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="muted px" style="padding:18px 32px 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:#9aa394;">
              If the button does not open, use this link:<br />
              <a href="${link}" style="color:#CBF805;text-decoration:underline;word-break:break-all;">${loginLabel}</a>
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
              <a href="${privacy}" style="color:#CBF805;text-decoration:underline;">Privacy</a>
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

function cardsText(items: readonly { title: string; body: string }[]) {
  return items.map((item) => `${item.title}\n${item.body}`).join("\n\n");
}

function liveText(greeting: string, support: string) {
  return [
    greeting,
    "",
    DOORS,
    "",
    WORK,
    "",
    "What's inside",
    "",
    cardsText(INSIDE),
    "",
    "How to get started",
    "",
    cardsText(STEPS),
    "",
    WEB_LINE,
    "",
    APPS_LINE,
    "",
    "Start training",
    WAITLIST_LIVE_CTA_URL,
    "",
    `If the button does not open, use this link: ${WAITLIST_LIVE_LOGIN_LABEL}`,
    WAITLIST_LIVE_LINK_URL,
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
    `Privacy: ${WAITLIST_LIVE_PRIVACY_URL}`,
  ].join("\n");
}

export function buildWaitlistLiveEmail(firstName: string) {
  const greeting = waitlistWelcomeGreeting(firstName);
  const greetingHtml = waitlistWelcomeGreetingHtml(firstName);
  const replyTo = supportEmail();
  return {
    subject: WAITLIST_LIVE_SUBJECT,
    preheader: WAITLIST_LIVE_PREHEADER,
    text: liveText(greeting, replyTo),
    html: liveHtml(greetingHtml, replyTo),
    replyTo,
  };
}

/**
 * One-shot launch mail. From is SMTP_FROM inside sendMail, same as the welcome.
 * Reply-To is the support inbox. A send failure is logged and swallowed.
 */
export async function sendWaitlistLiveEmail(input: { to: string; firstName: string }) {
  try {
    const mail = buildWaitlistLiveEmail(input.firstName);
    const result = await sendMail({
      to: input.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
    if (result.reason === "send_failed") {
      console.error("waitlist live email failed");
    }
    return result;
  } catch {
    console.error("waitlist live email failed");
    return { sent: false, reason: "send_failed" as const };
  }
}
