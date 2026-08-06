import type { NextApiRequest, NextApiResponse } from "next";
import type { NodeHTTPCreateContextFnOptions } from "@trpc/server/adapters/node-http";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";
import { createCorrelationId } from "@/server/observability/provider-error";

export type Context = {
  userId: string | null;
  sessionCreatedAt: Date | null;
  correlationId: string;
};

export async function createContext(
  opts: NodeHTTPCreateContextFnOptions<NextApiRequest, NextApiResponse>,
): Promise<Context> {
  const correlationId = createCorrelationId(opts.req.headers["x-correlation-id"]);
  opts.res.setHeader("x-correlation-id", correlationId);
  const session = await auth.api.getSession({
    headers: toRequestHeaders(opts.req.headers),
  });

  return {
    userId: session?.user.id ?? null,
    sessionCreatedAt: session?.session.createdAt
      ? new Date(session.session.createdAt)
      : null,
    correlationId,
  };
}
