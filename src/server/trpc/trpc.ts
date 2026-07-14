import { initTRPC, TRPCError } from "@trpc/server";
import {
  RECENT_AUTH_REQUIRED_MESSAGE,
  getRecentAuthStatus,
} from "@/lib/recent-auth";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      sessionCreatedAt: ctx.sessionCreatedAt,
    },
  });
});

const enforceRecentAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const status = getRecentAuthStatus(ctx.sessionCreatedAt);
  if (!status.ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: RECENT_AUTH_REQUIRED_MESSAGE,
    });
  }

  return next({
    ctx: {
      userId: ctx.userId,
      sessionCreatedAt: ctx.sessionCreatedAt,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
export const recentAuthProcedure = t.procedure.use(enforceAuth).use(enforceRecentAuth);
