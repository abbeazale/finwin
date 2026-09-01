import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/index";
import { bankConnections } from "@/db/schema";
import {
  createCorrelationId,
  logProviderError,
} from "@/server/observability/provider-error";
import { sweepDuePlaidRevocationsSafely } from "@/server/plaid/revocation";
import {
  RequestBodyTooLargeError,
  readBoundedRawBody,
} from "@/server/plaid/raw-body";
import {
  syncConnection,
  syncInvestmentHoldings,
  syncInvestmentTransactions,
} from "@/server/plaid/sync";
import {
  markConnectionLinked,
  markConnectionSyncFailed,
  runConnectionSyncAttempt,
} from "@/server/plaid/connection-sync-state";
import { verifyPlaidWebhook } from "@/server/plaid/webhook-verify";

// Next's default body parser would strip whitespace and break request_body_sha256.
export const config = { api: { bodyParser: false } };

const plaidWebhookPayloadSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string(),
  error: z.object({ error_code: z.string() }).optional(),
});

type PlaidWebhookPayload = z.infer<typeof plaidWebhookPayloadSchema>;

const SYNC_CODES = new Set([
  "SYNC_UPDATES_AVAILABLE",
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
  "DEFAULT_UPDATE",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const correlationId = createCorrelationId(req.headers["x-correlation-id"]);
  res.setHeader("x-correlation-id", correlationId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedRawBody(req);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ error: "Request body too large." });
    }
    throw err;
  }

  const signature = req.headers["plaid-verification"];
  const signatureHeader = Array.isArray(signature) ? signature[0] : signature;

  const verification = await verifyPlaidWebhook(signatureHeader, rawBody);
  if (!verification.ok) {
    console.warn("plaid webhook rejected:", verification.reason);
    return res.status(401).json({ error: "Invalid signature." });
  }

  let payload: PlaidWebhookPayload;
  try {
    const parsedPayload: unknown = JSON.parse(rawBody);
    const result = plaidWebhookPayloadSchema.safeParse(parsedPayload);
    if (!result.success) {
      return res.status(400).json({ error: "Unsupported Plaid webhook payload." });
    }
    payload = result.data;
  } catch {
    return res.status(400).json({ error: "Bad JSON." });
  }

  const [connection] = await db
    .select({ id: bankConnections.id })
    .from(bankConnections)
    .where(eq(bankConnections.providerItemId, payload.item_id))
    .limit(1);

  if (!connection) {
    // Ack so Plaid stops retrying; we just don't know this item.
    logProviderError(undefined, {
      operation: "plaid-webhook-connection-lookup",
      correlationId,
      errorCode: "CONNECTION_NOT_FOUND",
    });
  } else {
    try {
      if (payload.webhook_type === "TRANSACTIONS" && SYNC_CODES.has(payload.webhook_code)) {
        // Plaid retries on non-2xx responses, so keep this handler synchronous until sync volume warrants a durable queue.
        await syncConnection(connection.id);
      } else if (payload.webhook_type === "HOLDINGS" && payload.webhook_code === "DEFAULT_UPDATE") {
        await runConnectionSyncAttempt(connection.id, async () => {
          await syncInvestmentHoldings(connection.id);
          return { status: "ready" as const };
        });
      } else if (
        payload.webhook_type === "INVESTMENTS_TRANSACTIONS" &&
        payload.webhook_code === "DEFAULT_UPDATE"
      ) {
        await runConnectionSyncAttempt(connection.id, async () => {
          await syncInvestmentTransactions(connection.id);
          return { status: "ready" as const };
        });
      } else if (payload.webhook_type === "ITEM") {
        if (payload.webhook_code === "ERROR") {
          await markConnectionSyncFailed(
            connection.id,
            payload.error?.error_code ?? "ITEM_ERROR",
          );
        } else if (payload.webhook_code === "PENDING_EXPIRATION") {
          await markConnectionSyncFailed(connection.id, "PENDING_EXPIRATION");
        } else if (payload.webhook_code === "LOGIN_REPAIRED") {
          await markConnectionLinked(connection.id);
        }
      }
    } catch (err) {
      logProviderError(err, {
        operation: "plaid-webhook-sync",
        correlationId,
        connectionId: connection.id,
      });
      // Still 200 so Plaid doesn't hammer us; we have logs.
    }
  }

  // Hobby cannot schedule Vercel Cron, so due revocations ride along here.
  await sweepDuePlaidRevocationsSafely(correlationId);
  return res.status(200).json({ ok: true });
}
