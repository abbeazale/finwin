import type { NextApiRequest, NextApiResponse } from "next";
import { refreshOpenExchangeRates } from "@/server/investments/fx";

type RefreshResponse =
  | Awaited<ReturnType<typeof refreshOpenExchangeRates>>
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RefreshResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const refreshSecret = process.env.FX_REFRESH_SECRET;
  if (!refreshSecret && process.env.NODE_ENV === "production") {
    return res.status(503).json({ error: "FX refresh secret is not configured." });
  }

  if (refreshSecret) {
    const authorization = req.headers.authorization;
    if (authorization !== `Bearer ${refreshSecret}`) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  }

  try {
    const result = await refreshOpenExchangeRates();
    return res.status(result.refreshed ? 200 : 503).json(result);
  } catch (error) {
    console.error("fx refresh failed", error);
    return res.status(500).json({ error: "FX refresh failed." });
  }
}
