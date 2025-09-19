import nodemailer, { SentMessageInfo } from "nodemailer";
import { getDb } from "../lib/mongo";

function getEnv(name: string, optional = false): string | undefined {
  const v = process.env[name];
  if (!v && !optional) throw new Error(`${name} is not set`);
  return v;
}

export class MailerSendError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "MailerSendError";
    this.status = status;
  }
}

type Classify = { retryable: boolean; status: number; userMessage: string };

function classifySmtpError(err: any): Classify {
  const resp: string = String(err?.response || err?.message || "");
  const code: number | undefined = typeof err?.responseCode === "number" ? err.responseCode : undefined;
  const isRateLimit = /4\.7\.0|rate ?limit|Too many|Try again later|Daily user sending limit/i.test(resp);
  if (isRateLimit || code === 421 || code === 454) {
    return { retryable: true, status: 429, userMessage: "Email provider is rate limiting. Please try again in a few minutes." };
  }
  if (code === 450 || code === 451 || code === 452) {
    return { retryable: true, status: 503, userMessage: "Email service is temporarily unavailable. Please try again." };
  }
  if (code === 535 || /Invalid credentials|authentication failed/i.test(resp)) {
    return { retryable: false, status: 500, userMessage: "Email service is unavailable. Please try again later." };
  }
  if (code === 550 || code === 553 || /mailbox unavailable|user unknown|relay denied/i.test(resp)) {
    return { retryable: false, status: 400, userMessage: "We couldn’t send the email to that address. Please check the email and try again." };
  }
  return { retryable: false, status: 500, userMessage: "We couldn’t send the email right now. Please try again later." };
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function createMailer() {
  const host = getEnv("SMTP_HOST")!;
  const port = Number(getEnv("SMTP_PORT") || 587);
  const user = getEnv("SMTP_USER")!;
  const pass = getEnv("SMTP_PASS")!;

  const isGmail = /gmail|googlemail|smtp\.google/i.test(host);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    pool: true,
    maxConnections: isGmail ? 1 : 5,
    maxMessages: undefined,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  } as any);

  async function logAttempt(entry: any) {
    try {
      const db = await getDb();
      await db.collection("mail_events").insertOne(entry);
    } catch {
      // best-effort; ignore logging failures
    }
  }

  async function sendWithRetry(payload: Parameters<typeof transporter.sendMail>[0], context: string): Promise<SentMessageInfo> {
    const attempts = isGmail ? 4 : 3;
    let lastErr: any = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        const info = await transporter.sendMail(payload);
        await logAttempt({
          provider: "smtp",
          host,
          to: payload["to"],
          subject: payload["subject"],
          context,
          attempt: i,
          success: true,
          ts: new Date(),
        });
        return info;
      } catch (err: any) {
        lastErr = err;
        const c = classifySmtpError(err);
        await logAttempt({
          provider: "smtp",
          host,
          to: payload["to"],
          subject: payload["subject"],
          context,
          attempt: i,
          success: false,
          errorName: String(err?.name || "Error"),
          errorMessage: String(err?.message || ""),
          response: String(err?.response || ""),
          responseCode: typeof err?.responseCode === "number" ? err.responseCode : null,
          classified: c,
          ts: new Date(),
        });
        if (!c.retryable || i === attempts) {
          throw new MailerSendError(c.userMessage, c.status);
        }
        const backoff = Math.min(15000, Math.floor(500 * Math.pow(2, i - 1)) + Math.floor(Math.random() * 250));
        await sleep(backoff);
      }
    }
    throw lastErr || new MailerSendError("Failed to send email", 500);
  }

  return {
    async sendOtp(to: string, code: string) {
      const from = getEnv("SMTP_USER")!;
      const subject = "Your AngelWrites verification code";
      const info = await sendWithRetry(
        {
          from: `AngelWrites <${from}>`,
          to,
          subject,
          text: `Your verification code is ${code}. It expires in 10 minutes.`,
          html: `<p>Your verification code is <strong style="font-size:18px">${code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
        },
        "otp"
      );
      return info;
    },
    verify: () => transporter.verify(),
  };
}
