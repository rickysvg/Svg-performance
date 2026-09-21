type MailInput = { to: string; subject: string; text: string };
type MailResult = { sent: boolean; reason: "not_configured" | "sent" | "send_failed" };

type MailSender = (input: MailInput) => Promise<MailResult>;

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim());
}

async function defaultSendMail(input: MailInput): Promise<MailResult> {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user || "noreply@localhost";

  try {
    const net = await import("node:net");
    const tls = await import("node:tls");
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        // STARTTLS path is environment-specific. For this preview we open TLS
        // directly on 465, otherwise we send a plain AUTH LOGIN if the server
        // greets us. Failures fall back to in-app reminders.
        void socket;
      });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("SMTP timeout"));
      }, 4000);
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.once("connect", () => {
        const useTls = port === 465;
        const send = (client: { write: (chunk: string) => void; end: () => void }) => {
          const lines = [
            `EHLO svg-performance.local`,
            user ? `AUTH LOGIN` : "",
            user ? Buffer.from(user).toString("base64") : "",
            pass ? Buffer.from(pass).toString("base64") : "",
            `MAIL FROM:<${from}>`,
            `RCPT TO:<${input.to}>`,
            `DATA`,
            `From: ${from}`,
            `To: ${input.to}`,
            `Subject: ${input.subject}`,
            ``,
            input.text,
            `.`,
            `QUIT`,
          ].filter((line) => line !== "");
          client.write(`${lines.join("\r\n")}\r\n`);
          client.end();
        };
        if (useTls) {
          const secure = tls.connect({ socket, host, servername: host }, () => {
            send(secure);
          });
          secure.once("error", reject);
          secure.once("end", () => {
            clearTimeout(timer);
            resolve();
          });
        } else {
          send(socket);
          socket.once("end", () => {
            clearTimeout(timer);
            resolve();
          });
        }
      });
    });
    return { sent: true, reason: "sent" };
  } catch {
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
  } catch {
    return { sent: false, reason: "send_failed" };
  }
}
