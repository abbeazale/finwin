import type { NextApiRequest, NextApiResponse } from "next";
import type { NodeHTTPCreateContextFnOptions } from "@trpc/server/adapters/node-http";
import { auth } from "@/lib/auth";
import { toRequestHeaders } from "@/lib/request-headers";

export type Context = {
  userId: string | null;
};

export async function createContext(
  opts: NodeHTTPCreateContextFnOptions<NextApiRequest, NextApiResponse>,
): Promise<Context> {
  try {
    const session = await auth.api.getSession({
      headers: toRequestHeaders(opts.req.headers),
    });
    return { userId: session?.user.id ?? null };
  } catch {
    return { userId: null };
  }
}
