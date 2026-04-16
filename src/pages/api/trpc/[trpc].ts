import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

export default createNextApiHandler({
  router: appRouter,
  createContext,
});
