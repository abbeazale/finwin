import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";
import { db } from "@/index";
import { bankConnections } from "@/db/schema";
import { plaid } from "@/server/plaid/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "PATCH") {
    res.setHeader("Allow", "DELETE, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await auth.api.getSession({
    headers: toRequestHeaders(req.headers),
  });
  if (!session) return res.status(401).json({ error: "Unauthorized." });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Missing id." });

  const [connection] = await db
    .select({
      id: bankConnections.id,
      accessToken: bankConnections.accessToken,
    })
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, session.user.id)))
    .limit(1);

  if (!connection) return res.status(404).json({ error: "Connection not found." });

  if (req.method === "PATCH") {
    // Only supported transition for now: mark active (used after Link update-mode success).
    const status = typeof req.body?.status === "string" ? req.body.status : "";
    if (status !== "active") {
      return res.status(400).json({ error: "Unsupported status transition." });
    }
    await db
      .update(bankConnections)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(bankConnections.id, connection.id));
    return res.status(200).json({ ok: true });
  }

  // DELETE
  try {
    await plaid.itemRemove({ access_token: connection.accessToken });
  } catch (err) {
    const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
    // Proceed with local revoke even if Plaid-side remove fails; token is dead on our end either way.
    console.error("plaid itemRemove failed (continuing with local revoke)", plaidErr ?? err);
  }

  // Soft revoke: keep bank_accounts + transactions for historical budgets.
  await db
    .update(bankConnections)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(bankConnections.id, connection.id));

  return res.status(200).json({ ok: true });
}
