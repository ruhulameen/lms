import nodemailer, { type Transporter } from "nodemailer";

export type MailMessage = { to: string; subject: string; text: string };

let transport: Transporter | undefined;

// One SMTP connection pool for the process, built from the SMTP_* settings.
function getTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT) || 587;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is TLS from the start; other ports upgrade with STARTTLS.
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    pool: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

// Sends one message over SMTP. Without SMTP_HOST (local development) the
// message is printed to the server console instead.
export async function deliverMail({ to, subject, text }: MailMessage) {
  if (!smtpConfigured()) {
    console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`);
    return;
  }
  await getTransport().sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text });
}
