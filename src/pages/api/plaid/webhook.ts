import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/index";
import { bankConnections } from "@/db/schema";
import { syncConnection } from "@/server/plaid/sync";
import { verifyPlaidWebhook } from "@/server/plaid/webhook-verify";

// Next's default body parser would strip whitespace and break request_body_sha256.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

type PlaidWebhookPayload = {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: { error_code?: string } | null;
};

const SYNC_CODES = new Set([
  "SYNC_UPDATES_AVAILABLE",
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
  "DEFAULT_UPDATE",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const rawBody = await readRawBody(req);

  const signature = req.headers["plaid-verification"];
  const signatureHeader = Array.isArray(signature) ? signature[0] : signature;

  const verification = await verifyPlaidWebhook(signatureHeader, rawBody);
  if (!verification.ok) {
    console.warn("plaid webhook rejected:", verification.reason);
    return res.status(401).json({ error: "Invalid signature." });
  }

  let payload: PlaidWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PlaidWebhookPayload;
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
    console.warn("plaid webhook for unknown item_id:", payload.item_id);
    return res.status(200).json({ ok: true });
  }

  try {
    if (payload.webhook_type === "TRANSACTIONS" && SYNC_CODES.has(payload.webhook_code)) {
      // Plaid retries on non-2xx responses, so keep this handler synchronous until sync volume warrants a durable queue.
      await syncConnection(connection.id);
    } else if (payload.webhook_type === "ITEM") {
      if (payload.webhook_code === "ERROR") {
        await db
          .update(bankConnections)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(bankConnections.id, connection.id));
      } else if (payload.webhook_code === "PENDING_EXPIRATION") {
        await db
          .update(bankConnections)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(bankConnections.id, connection.id));
      } else if (payload.webhook_code === "LOGIN_REPAIRED") {
        await db
          .update(bankConnections)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(bankConnections.id, connection.id));
      }
    }
  } catch (err) {
    console.error("plaid webhook handler error", err);
    // Still 200 so Plaid doesn't hammer us; we have logs.
  }

  return res.status(200).json({ ok: true });
}
