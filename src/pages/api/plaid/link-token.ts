import type { NextApiRequest, NextApiResponse } from "next";
import { CountryCode, Products } from "plaid";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";
import { plaid } from "@/server/plaid/client";

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

  try {
    const { data } = await plaid.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "FinWin",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    });

    return res.status(200).json({ link_token: data.link_token, expiration: data.expiration });
  } catch (err: unknown) {
    const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
    console.error("plaid linkTokenCreate failed", plaidErr ?? err);
    return res.status(500).json({ error: "Failed to create link token." });
  }
}
