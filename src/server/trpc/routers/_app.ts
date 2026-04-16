import { router } from "../trpc";
import { plaidRouter } from "./plaid";
import { transactionsRouter } from "./transactions";

export const appRouter = router({
  plaid: plaidRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
