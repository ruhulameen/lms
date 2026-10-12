"use server";

import { z } from "zod";
import { contactSubjects } from "@/lib/contact";
import { sendEmail } from "@/lib/email";

const SUPPORT_EMAIL = "support@edxlearning.co.uk";

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().max(40),
  subject: z.enum(contactSubjects),
  message: z.string().trim().min(10).max(5000),
});

export type ContactState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export async function sendContactMessage(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Please fill in your name, a valid email and a message of at least 10 characters.",
    };
  }

  const { firstName, lastName, email, phone, subject, message } = parsed.data;
  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Contact] ${subject}`,
    text: `From: ${firstName} ${lastName} <${email}>\nPhone: ${phone || "-"}\n\n${message}`,
  });

  return { status: "sent" };
}
