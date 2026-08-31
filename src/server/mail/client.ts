import { Resend } from "resend";
import { getServerEnvironment } from "@/server/env";

let cachedClient: Resend | undefined;

/**
 * Returns the Resend client, or undefined when no API key is configured.
 *
 * The environment contract requires RESEND_API_KEY in staging and production,
 * so undefined is only reachable in local development and preview.
 */
export function getResend(): Resend | undefined {
  const apiKey = getServerEnvironment().resendApiKey;
  if (!apiKey) return undefined;
  cachedClient ??= new Resend(apiKey);
  return cachedClient;
}
