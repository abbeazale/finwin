CREATE TABLE "pending_provider_revocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"provider_item_id" text NOT NULL,
	"access_token_encrypted" text,
	"access_token_key_version" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error_code" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_provider_revocations" ADD CONSTRAINT "pending_provider_revocations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_provider_revocations_due_idx" ON "pending_provider_revocations" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_provider_revocations_item_unique" ON "pending_provider_revocations" USING btree ("provider_item_id");