import { router } from "../trpc";
import { plaidRouter } from "./plaid";

export const appRouter = router({
  plaid: plaidRouter,
});

export type AppRouter = typeof appRouter;
