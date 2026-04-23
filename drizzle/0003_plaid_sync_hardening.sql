ALTER TABLE "bank_connections" ADD COLUMN "last_synced_at" timestamptz;
ALTER TABLE "bank_connections" ADD COLUMN "sync_error_code" text;
