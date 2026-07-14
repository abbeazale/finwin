CREATE TABLE "sandbox_portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"starting_cash" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"price" numeric(12, 4) NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sandbox_portfolios" ADD CONSTRAINT "sandbox_portfolios_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_trades" ADD CONSTRAINT "sandbox_trades_portfolio_id_sandbox_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."sandbox_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_trades" ADD CONSTRAINT "sandbox_trades_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sandbox_portfolios_user_id_idx" ON "sandbox_portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_portfolios_user_name_unique" ON "sandbox_portfolios" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "sandbox_trades_portfolio_executed_at_idx" ON "sandbox_trades" USING btree ("portfolio_id","executed_at");--> statement-breakpoint
CREATE INDEX "sandbox_trades_user_id_idx" ON "sandbox_trades" USING btree ("user_id");