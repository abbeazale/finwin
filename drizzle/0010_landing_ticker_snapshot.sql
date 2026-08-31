CREATE TABLE "market_quote_snapshots" (
	"key" text PRIMARY KEY NOT NULL,
	"quotes" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
