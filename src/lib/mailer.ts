import nodemailer, { type Transporter } from "nodemailer";
import type { Settings } from "@/lib/settings-schema";
import { getSettings } from "@/lib/settings-store";

export type MailMessage = { to: string; subject: string; text: string };

type Smtp = NonNullable<Settings["email"]["smtp"]>;

function createTransport(smtp: Smtp, pool: boolean) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // 465 is TLS from the start; other ports upgrade with STARTTLS.
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    pool,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

let pooled: { signature: string; transport: Transporter } | undefined;

// One SMTP connection pool for the process, built from Settings > Email (or
// the SMTP_* values in .env) and rebuilt when those change.
function getTransport(smtp: Smtp) {
  const signature = JSON.stringify(smtp);
  if (pooled?.signature !== signature) {
    pooled?.transport.close();
    pooled = { signature, transport: createTransport(smtp, true) };
  }
  return pooled.transport;
}

export function smtpConfigured() {
  return Boolean(getSettings().email.smtp);
}

// Sends one message over SMTP. With no mail server set up (local development)
// the message is printed to the server console instead.
export async function deliverMail({ to, subject, text }: MailMessage) {
  const { smtp, from, replyTo } = getSettings().email;
  if (!smtp) {
    console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`);
    return;
  }
  await getTransport(smtp).sendMail({ from: from || smtp.user, replyTo: replyTo || undefined, to, subject, text });
}

// Sends one message now, over a connection of its own, and reports what the
// mail server said. For the "Send test email" button: nothing is queued.
export async function deliverMailNow(message: MailMessage, email: Settings["email"]) {
  if (!email.smtp) throw new Error("No mail server is set up.");
  const transport = createTransport(email.smtp, false);
  try {
    await transport.sendMail({ from: email.from || email.smtp.user, replyTo: email.replyTo || undefined, ...message });
  } finally {
    transport.close();
  }
}
