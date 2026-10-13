import { db } from "@/lib/db";
import { EMAIL_MAX_ATTEMPTS, nextEmailTry } from "@/lib/email-retry";
import { deliverMail } from "@/lib/mailer";

type Email = {
  to: string;
  subject: string;
  text: string;
};

// A send that started this long ago and never finished is treated as failed.
const STUCK_AFTER_MS = 10 * 60_000;

// Queues an email and returns straight away: the row is written now, and the
// SMTP conversation happens after the response has been sent, so sign-up,
// checkout and the rest never wait on the mail server. A failed send is tried
// again later (see nextEmailTry), picked up the next time any email is queued.
export async function sendEmail({ to, subject, text }: Email) {
  const { id } = await db.emailOutbox.create({ data: { to, subject, text }, select: { id: true } });
  await runAfterResponse(async () => {
    await deliverQueuedEmail(id);
    await deliverDueEmails();
  });
}

// Next's after() needs a request; scripts (the seed) have none, so there the
// task simply runs in the background. Imported lazily for the same reason.
async function runAfterResponse(task: () => Promise<void>) {
  const run = () => task().catch((error) => console.error("[email] delivery failed", error));
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}

// Sends one queued email. Claiming the row first means two requests can never
// send the same email twice.
export async function deliverQueuedEmail(id: number) {
  const claimed = await db.emailOutbox.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED"] }, attempts: { lt: EMAIL_MAX_ATTEMPTS } },
    data: { status: "SENDING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;
  const email = await db.emailOutbox.findUnique({ where: { id }, select: { to: true, subject: true, text: true, attempts: true } });
  if (!email) return;

  try {
    await deliverMail(email);
    await db.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null, text: "" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryAt = nextEmailTry(email.attempts, new Date());
    await db.emailOutbox.update({
      where: { id },
      data: { status: "FAILED", lastError: message.slice(0, 2000), ...(retryAt ? { nextTryAt: retryAt } : {}) },
    });
    console.error(`[email] #${id} to ${email.to} failed (attempt ${email.attempts}): ${message}`);
  }
}

// Retries whatever is due: failed sends whose wait is over, and rows left
// behind by a request that died before delivering.
export async function deliverDueEmails(limit = 10) {
  const now = new Date();
  await db.emailOutbox.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { status: "FAILED", lastError: "Sending did not finish." },
  });
  const due = await db.emailOutbox.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: EMAIL_MAX_ATTEMPTS }, nextTryAt: { lte: now } },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const { id } of due) await deliverQueuedEmail(id);
}
