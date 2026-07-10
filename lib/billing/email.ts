import "server-only";
import { Resend } from "resend";

// Lazy init: a module-top-level `new Resend(...)` throws "Missing API key" during
// `next build` when RESEND_API_KEY is unset. Defer to first use.
let _resend: Resend | null = null;
const getResend = () => (_resend ??= new Resend(process.env.RESEND_API_KEY));
const FROM = process.env.EMAIL_FROM ?? "billing@epistemic-receipts.app";

export async function sendPaymentFailedEmail(toEmail: string, orgName: string): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `Action required: payment failed for ${orgName}`,
    html: `
      <p>Hi,</p>
      <p>We were unable to process your payment for <strong>${orgName}</strong> on Epistemic Receipts.</p>
      <p>Your API access will remain active for 7 days. After that, rate limits will drop to the free tier until payment is resolved.</p>
      <p><a href="https://epistemic-receipts.app/account">Update your payment method →</a></p>
      <p>If you have questions, reply to this email.</p>
    `,
  });
}
