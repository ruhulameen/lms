type Email = {
  to: string;
  subject: string;
  text: string;
};

// No email provider yet: messages are printed to the server console.
export async function sendEmail({ to, subject, text }: Email) {
  console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`);
}
