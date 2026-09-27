import { afterEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, createTransport } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransport };
});

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

import { passwordResetHtml, sendMail, setMailSenderForTests } from "@/lib/mail";

const FROM = "SVG Performance <no-reply@svgmmaacademy.com>";
const PASS = "re_test_secret_key";

function setSmtpEnv() {
  process.env.SMTP_HOST = "smtp.resend.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_USER = "resend";
  process.env.SMTP_PASS = PASS;
  process.env.SMTP_FROM = FROM;
}

function clearSmtpEnv() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
}

describe("smtp mail", () => {
  afterEach(() => {
    setMailSenderForTests(null);
    sendMailMock.mockReset();
    createTransport.mockClear();
    clearSmtpEnv();
    vi.restoreAllMocks();
  });

  it("passes a display-name From header through to the SMTP client", async () => {
    setSmtpEnv();
    sendMailMock.mockResolvedValue({
      accepted: ["rmaynez21@gmail.com"],
      rejected: [],
    });
    const html = passwordResetHtml(
      "https://svg-performance.vercel.app/reset-password?token=abc",
    );

    const result = await sendMail({
      to: "rmaynez21@gmail.com",
      subject: "Reset your SVG Performance password",
      text: "Reset link (expires in 1 hour): https://svg-performance.vercel.app/reset-password?token=abc",
      html,
    });

    expect(result).toEqual({ sent: true, reason: "sent" });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: FROM,
        to: "rmaynez21@gmail.com",
        html,
      }),
    );
    expect(html).toContain("background:#ffffff");
    expect(html).toContain("#CBF805");
    expect(html).toContain(">Reset password<");
    expect(html).toContain(
      "https://svg-performance.vercel.app/reset-password?token=abc",
    );
  });

  it("returns sent false unless the recipient was accepted", async () => {
    setSmtpEnv();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMailMock.mockResolvedValue({ accepted: [], rejected: ["rmaynez21@gmail.com"] });

    const result = await sendMail({
      to: "rmaynez21@gmail.com",
      subject: "Reset your SVG Performance password",
      text: "link",
    });

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(errorLog).toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(PASS);
  });

  it("logs a failure without the password when SMTP rejects the connection", async () => {
    setSmtpEnv();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMailMock.mockRejectedValue(new Error(`auth failed for ${PASS}`));

    const result = await sendMail({
      to: "rmaynez21@gmail.com",
      subject: "Reset your SVG Performance password",
      text: "link",
    });

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(errorLog).toHaveBeenCalled();
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain(PASS);
    expect(logged).toContain("[redacted]");
  });
});
