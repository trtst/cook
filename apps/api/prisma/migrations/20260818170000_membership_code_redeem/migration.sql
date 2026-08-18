CREATE TYPE "MembershipCodeKind" AS ENUM ('FORMAL', 'TRIAL');
CREATE TYPE "MembershipCodeStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'DISABLED');

CREATE TABLE "membership_skus" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "kind" "MembershipCodeKind" NOT NULL,
  "tier" "EntitlementTier" NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "redeem_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "membership_skus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "membership_code_batches" (
  "id" SERIAL NOT NULL,
  "sku_id" INTEGER NOT NULL,
  "name" VARCHAR(64) NOT NULL,
  "redeem_enabled" BOOLEAN NOT NULL DEFAULT false,
  "starts_at" TIMESTAMPTZ(3),
  "ends_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "membership_code_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "membership_codes" (
  "id" SERIAL NOT NULL,
  "batch_id" INTEGER NOT NULL,
  "code_hash" VARCHAR(128) NOT NULL,
  "code_mask" VARCHAR(64) NOT NULL,
  "status" "MembershipCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "redeemed_by_user_id" INTEGER,
  "redeemed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "membership_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "membership_skus_code_key" ON "membership_skus"("code");
CREATE INDEX "membership_skus_kind_tier_duration_days_idx" ON "membership_skus"("kind", "tier", "duration_days");

CREATE INDEX "membership_code_batches_sku_id_redeem_enabled_starts_at_ends_at_idx"
ON "membership_code_batches"("sku_id", "redeem_enabled", "starts_at", "ends_at");

CREATE UNIQUE INDEX "membership_codes_code_hash_key" ON "membership_codes"("code_hash");
CREATE INDEX "membership_codes_batch_id_status_id_idx" ON "membership_codes"("batch_id", "status", "id");
CREATE INDEX "membership_codes_redeemed_by_user_id_redeemed_at_idx" ON "membership_codes"("redeemed_by_user_id", "redeemed_at");
CREATE INDEX "membership_codes_status_redeemed_at_idx" ON "membership_codes"("status", "redeemed_at");

ALTER TABLE "membership_skus"
ADD CONSTRAINT "membership_skus_duration_days_ck"
CHECK (
  ("kind" = 'FORMAL' AND "duration_days" IN (30, 90, 365))
  OR ("kind" = 'TRIAL' AND "duration_days" IN (1, 3, 7) AND "tier" = 'PRO')
);

ALTER TABLE "membership_code_batches"
ADD CONSTRAINT "membership_code_batches_time_window_ck"
CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "starts_at" < "ends_at");

ALTER TABLE "membership_codes"
ADD CONSTRAINT "membership_codes_redeemed_state_ck"
CHECK (
  ("status" = 'ACTIVE' AND "redeemed_by_user_id" IS NULL AND "redeemed_at" IS NULL)
  OR ("status" = 'DISABLED' AND "redeemed_by_user_id" IS NULL AND "redeemed_at" IS NULL)
  OR ("status" = 'REDEEMED' AND "redeemed_by_user_id" IS NOT NULL AND "redeemed_at" IS NOT NULL)
);

ALTER TABLE "membership_code_batches"
ADD CONSTRAINT "membership_code_batches_sku_id_fkey"
FOREIGN KEY ("sku_id") REFERENCES "membership_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "membership_codes"
ADD CONSTRAINT "membership_codes_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "membership_code_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_codes"
ADD CONSTRAINT "membership_codes_redeemed_by_user_id_fkey"
FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
