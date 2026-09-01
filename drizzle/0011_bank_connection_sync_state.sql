UPDATE "bank_connections"
SET
	"status" = CASE
		WHEN "status" = 'active' AND "last_synced_at" IS NOT NULL THEN 'ready'
		WHEN "status" = 'active' THEN 'linked'
		WHEN "status" = 'error' THEN 'sync_failed'
		ELSE "status"
	END,
	"sync_error_code" = CASE
		WHEN "status" = 'error' THEN coalesce("sync_error_code", 'UNKNOWN')
		ELSE NULL
	END;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_status_check" CHECK ("bank_connections"."status" in ('linked', 'syncing', 'ready', 'sync_failed'));--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_sync_error_check" CHECK (("bank_connections"."status" = 'sync_failed' and "bank_connections"."sync_error_code" is not null) or ("bank_connections"."status" <> 'sync_failed' and "bank_connections"."sync_error_code" is null));
