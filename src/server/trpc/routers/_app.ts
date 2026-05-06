import { budgetsRouter } from "./budgets";
import { dashboardRouter } from "./dashboard";
import { onboardingRouter } from "./onboarding";
import { router } from "../trpc";
import { plaidRouter } from "./plaid";
import { transactionsRouter } from "./transactions";

export const appRouter = router({
  budgets: budgetsRouter,
  dashboard: dashboardRouter,
  onboarding: onboardingRouter,
  plaid: plaidRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
