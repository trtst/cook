ALTER TABLE "sms_codes" ALTER COLUMN "code_hash" DROP NOT NULL;
ALTER TABLE "sms_codes" ADD COLUMN "provider_out_id" VARCHAR(128);
