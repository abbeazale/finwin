ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_connection_id_bank_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "connection_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "category_confidence";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "notes";