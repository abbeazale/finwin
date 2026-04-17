import { budgetsRouter } from "./budgets";
import { router } from "../trpc";
import { plaidRouter } from "./plaid";
import { transactionsRouter } from "./transactions";

export const appRouter = router({
  budgets: budgetsRouter,
  plaid: plaidRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
