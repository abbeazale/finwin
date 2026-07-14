ALTER TABLE "sandbox_portfolios" ADD CONSTRAINT "sandbox_portfolios_starting_cash_check" CHECK ("sandbox_portfolios"."starting_cash" >= 0);--> statement-breakpoint
ALTER TABLE "sandbox_trades" ADD CONSTRAINT "sandbox_trades_side_check" CHECK ("sandbox_trades"."side" in ('buy', 'sell'));--> statement-breakpoint
ALTER TABLE "sandbox_trades" ADD CONSTRAINT "sandbox_trades_quantity_check" CHECK ("sandbox_trades"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "sandbox_trades" ADD CONSTRAINT "sandbox_trades_price_check" CHECK ("sandbox_trades"."price" >= 0);
