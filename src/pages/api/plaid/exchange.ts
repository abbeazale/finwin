import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";
import { plaid } from "@/server/plaid/client";
import { db } from "@/index";
import { bankAccounts, bankConnections } from "@/db/schema";
import { syncConnection } from "@/server/plaid/sync";

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

  const publicToken =
    typeof req.body?.public_token === "string" ? req.body.public_token : "";

  if (!publicToken) {
    return res.status(400).json({ error: "public_token is required." });
  }

  try {
    const { data: exchange } = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchange.access_token;
    const itemId = exchange.item_id;

    const { data: accountsRes } = await plaid.accountsGet({ access_token: accessToken });

    const [connection] = await db
      .insert(bankConnections)
      .values({
        userId: session.user.id,
        provider: "plaid",
        providerItemId: itemId,
        accessToken,
        status: "active",
      })
      .returning({ id: bankConnections.id });

    if (accountsRes.accounts.length > 0) {
      await db.insert(bankAccounts).values(
        accountsRes.accounts.map((acct) => ({
          userId: session.user.id,
          connectionId: connection.id,
          providerAccountId: acct.account_id,
          name: acct.name,
          type: acct.type,
          subtype: acct.subtype ?? null,
          mask: acct.mask ?? null,
          currency: acct.balances.iso_currency_code ?? "CAD",
        })),
      );
    }

    let initialSync: { added: number; modified: number; removed: number } | null = null;
    try {
      const r = await syncConnection(connection.id);
      initialSync = { added: r.added, modified: r.modified, removed: r.removed };
    } catch (err) {
      console.error("initial sync failed (non-fatal)", err);
    }

    return res.status(200).json({
      connectionId: connection.id,
      accountCount: accountsRes.accounts.length,
      initialSync,
    });
  } catch (err: unknown) {
    const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
    console.error("plaid exchange failed", plaidErr ?? err);
    return res.status(500).json({ error: "Failed to exchange public token." });
  }
}
