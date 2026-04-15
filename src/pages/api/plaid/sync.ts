import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";
import { db } from "@/index";
import { bankConnections } from "@/db/schema";
import { syncConnection, syncUserConnections } from "@/server/plaid/sync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await auth.api.getSession({
    headers: toRequestHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const connectionId =
    typeof req.body?.connectionId === "string" ? req.body.connectionId : null;

  try {
    if (connectionId) {
      // Ownership check before syncing a specific connection.
      const [owned] = await db
        .select({ id: bankConnections.id })
        .from(bankConnections)
        .where(
          and(
            eq(bankConnections.id, connectionId),
            eq(bankConnections.userId, session.user.id),
          ),
        )
        .limit(1);

      if (!owned) return res.status(404).json({ error: "Connection not found." });

      const result = await syncConnection(connectionId);
      return res.status(200).json({ results: [result] });
    }

    const results = await syncUserConnections(session.user.id);
    return res.status(200).json({ results });
  } catch (err: unknown) {
    const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
    console.error("plaid sync failed", plaidErr ?? err);
    return res.status(500).json({ error: "Sync failed." });
  }
}
