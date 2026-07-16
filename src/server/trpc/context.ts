import type { NextApiRequest, NextApiResponse } from "next";
import type { NodeHTTPCreateContextFnOptions } from "@trpc/server/adapters/node-http";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";

export type Context = {
  userId: string | null;
  sessionCreatedAt: Date | null;
};

export async function createContext(
  opts: NodeHTTPCreateContextFnOptions<NextApiRequest, NextApiResponse>,
): Promise<Context> {
  const session = await auth.api.getSession({
    headers: toRequestHeaders(opts.req.headers),
  });

  return {
    userId: session?.user.id ?? null,
    sessionCreatedAt: session?.session.createdAt
      ? new Date(session.session.createdAt)
      : null,
  };
}
