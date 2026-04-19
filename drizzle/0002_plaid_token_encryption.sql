ALTER TABLE "bank_connections" DROP COLUMN "access_token";
ALTER TABLE "bank_connections" ADD COLUMN "access_token_encrypted" text NOT NULL;
ALTER TABLE "bank_connections" ADD COLUMN "access_token_key_version" text NOT NULL;
