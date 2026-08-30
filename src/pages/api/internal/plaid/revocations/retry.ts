import type { NextApiRequest, NextApiResponse } from "next";
import {
  createCorrelationId,
  logProviderError,
} from "@/server/observability/provider-error";
import {
  runDuePlaidRevocations,
  type PendingRevocationSummary,
} from "@/server/plaid/revocation";
import { getServerEnvironment } from "@/server/env";

type RetryResponse = PendingRevocationSummary | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RetryResponse>,
) {
  const correlationId = createCorrelationId(req.headers["x-correlation-id"]);
  res.setHeader("x-correlation-id", correlationId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const env = getServerEnvironment();
  const retrySecret = env.plaidRevocationRetrySecret;
  if (!retrySecret && env.deployment !== "local") {
    return res.status(503).json({ error: "Revocation retry secret is not configured." });
  }

  if (retrySecret) {
    const authorization = req.headers.authorization;
    if (authorization !== `Bearer ${retrySecret}`) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  }

  try {
    const summary = await runDuePlaidRevocations({ correlationId });
    return res.status(200).json(summary);
  } catch (error) {
    logProviderError(error, {
      operation: "plaid-item-remove-retry",
      correlationId,
      errorCode: "REVOCATION_SWEEP_FAILED",
    });
    return res.status(500).json({ error: "Revocation retry failed." });
  }
}
