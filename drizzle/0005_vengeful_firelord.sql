CREATE TABLE "currency_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"security_id" uuid NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"cost_basis" numeric(12, 2),
	"institution_price" numeric(12, 4) NOT NULL,
	"institution_price_as_of" date,
	"iso_currency_code" text,
	"unofficial_currency_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"security_id" uuid,
	"plaid_investment_transaction_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(18, 8),
	"plaid_amount" numeric(12, 2) NOT NULL,
	"price" numeric(12, 4),
	"fees" numeric(12, 2),
	"type" text NOT NULL,
	"subtype" text,
	"iso_currency_code" text,
	"unofficial_currency_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "securities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plaid_security_id" text NOT NULL,
	"ticker_symbol" text,
	"name" text,
	"type" text,
	"is_cash_equivalent" boolean DEFAULT false NOT NULL,
	"close_price" numeric(12, 4),
	"close_price_as_of" date,
	"iso_currency_code" text,
	"unofficial_currency_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "currency_rates_base_quote_unique" ON "currency_rates" USING btree ("base_currency","quote_currency");--> statement-breakpoint
CREATE INDEX "investment_holdings_user_id_idx" ON "investment_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_holdings_account_id_idx" ON "investment_holdings" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_holdings_account_security_unique" ON "investment_holdings" USING btree ("account_id","security_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_user_date_idx" ON "investment_transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "investment_transactions_account_id_idx" ON "investment_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_transactions_plaid_id_unique" ON "investment_transactions" USING btree ("plaid_investment_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "securities_plaid_security_id_unique" ON "securities" USING btree ("plaid_security_id");