import { getServerEnvironment } from "@/server/env";
import { logProviderError } from "@/server/observability/provider-error";
import { getResend } from "./client";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type MailDeliveryOutcome =
  | "sent"
  | "printed-to-console"
  | "not-configured"
  | "failed";

/**
 * Sends one transactional email.
 *
 * This function never throws and never logs the recipient, the subject, or the
 * body. Reset links are single-use credentials, so only the outcome and a
 * correlation id are recorded.
 */
export async function sendTransactionalEmail(
  email: OutboundEmail,
  correlationId: string,
): Promise<MailDeliveryOutcome> {
  const env = getServerEnvironment();
  const resend = getResend();

  if (!resend || !env.mailFrom) {
    if (env.deployment === "local") {
      // Local development has no mail provider. Print the message so the
      // developer can follow the link. Never do this in a deployed environment.
      console.info(`\n--- FinWin local email ---\n${email.text}\n--------------------------\n`);
      return "printed-to-console";
    }
    logProviderError(new Error("mail transport unavailable"), {
      operation: "resend-email-send",
      correlationId,
      errorCode: "MAIL_NOT_CONFIGURED",
    });
    return "not-configured";
  }

  try {
    const { error } = await resend.emails.send({
      from: env.mailFrom,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (error) {
      logProviderError(error, {
        operation: "resend-email-send",
        correlationId,
        errorCode: "MAIL_REJECTED",
      });
      return "failed";
    }

    return "sent";
  } catch (err) {
    logProviderError(err, {
      operation: "resend-email-send",
      correlationId,
      errorCode: "MAIL_TRANSPORT_ERROR",
    });
    return "failed";
  }
}
