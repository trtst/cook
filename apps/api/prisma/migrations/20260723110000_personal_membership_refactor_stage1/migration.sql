DROP TRIGGER IF EXISTS "trg_validate_groups_current" ON "dining_groups";
DROP TRIGGER IF EXISTS "trg_validate_members_current" ON "dining_group_members";
DROP TRIGGER IF EXISTS "trg_validate_user_spaces_current" ON "user_spaces";
DROP FUNCTION IF EXISTS "validate_current_user_space"();

ALTER TABLE "dining_groups"
  DROP CONSTRAINT IF EXISTS "ck_dining_groups_status_time";

ALTER TABLE "dining_group_members"
  DROP CONSTRAINT IF EXISTS "ck_dining_group_members_state";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiningGroupStatus') THEN
    ALTER TYPE "DiningGroupStatus" RENAME TO "DiningGroupStatus_old";
  END IF;
END $$;

CREATE TYPE "DiningGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

UPDATE "dining_groups"
SET "status" = 'ARCHIVED'
WHERE "status"::text = 'FROZEN';

ALTER TABLE "dining_groups"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "DiningGroupStatus"
  USING (
    CASE
      WHEN "status"::text = 'FROZEN' THEN 'ARCHIVED'
      ELSE "status"::text
    END
  )::"DiningGroupStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE IF EXISTS "DiningGroupStatus_old";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LongTermMemberStatusReason') THEN
    ALTER TYPE "LongTermMemberStatusReason" RENAME TO "LongTermMemberStatusReason_old";
  END IF;
END $$;

CREATE TYPE "LongTermMemberStatusReason" AS ENUM (
  'LEFT',
  'REMOVED',
  'USER_OVER_LIMIT',
  'OWNER_OVER_LIMIT',
  'GROUP_DISSOLVED'
);

ALTER TABLE "dining_group_members"
  ALTER COLUMN "status_reason" TYPE "LongTermMemberStatusReason"
  USING (
    CASE
      WHEN "status_reason"::text IN ('LEFT', 'REMOVED', 'GROUP_DISSOLVED') THEN "status_reason"::text
      ELSE NULL
    END
  )::"LongTermMemberStatusReason";

DROP TYPE IF EXISTS "LongTermMemberStatusReason_old";

ALTER TABLE "dining_groups"
  ADD CONSTRAINT "ck_dining_groups_status_time" CHECK (
    ("status" = 'ACTIVE' AND "archived_at" IS NULL)
    OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
  );

ALTER TABLE "dining_group_members"
  ADD CONSTRAINT "ck_dining_group_members_state" CHECK (
    (
      "status" = 'ACTIVE'
      AND "status_reason" IS NULL
      AND "restricted_at" IS NULL
      AND "ended_at" IS NULL
    )
    OR (
      "status" = 'RESTRICTED'
      AND "status_reason" IN ('USER_OVER_LIMIT', 'OWNER_OVER_LIMIT')
      AND "restricted_at" IS NOT NULL
      AND "ended_at" IS NULL
    )
    OR (
      "status" = 'ENDED'
      AND "status_reason" IS NOT NULL
      AND "ended_at" IS NOT NULL
    )
  );

ALTER TABLE "dining_groups"
  DROP COLUMN IF EXISTS "frozen_at";

DROP TABLE IF EXISTS "carry_back_snapshots";
DROP TABLE IF EXISTS "user_spaces";

DROP TYPE IF EXISTS "CarryBackSnapshotStatus";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EntitlementTier') THEN
    CREATE TYPE "EntitlementTier" AS ENUM ('FREE', 'PLUS', 'PRO', 'ULTRA');
  END IF;
END $$;

DELETE FROM "entitlement_grants" WHERE "dining_group_id" IS NOT NULL;

ALTER TABLE "entitlement_grants"
  ADD COLUMN IF NOT EXISTS "tier" "EntitlementTier" NOT NULL DEFAULT 'PLUS';

ALTER TABLE "entitlement_grants"
  DROP CONSTRAINT IF EXISTS "entitlement_grants_dining_group_id_key";

ALTER TABLE "entitlement_grants"
  DROP CONSTRAINT IF EXISTS "entitlement_grants_dining_group_id_fkey";

ALTER TABLE "entitlement_grants"
  ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "entitlement_grants"
  DROP COLUMN IF EXISTS "dining_group_id";

DROP INDEX IF EXISTS "dining_group_invites_token_hash_status_expires_at_idx";
CREATE INDEX "dining_group_invites_token_hash_status_expires_at_idx"
  ON "dining_group_invites"("token_hash", "status", "expires_at");

CREATE INDEX IF NOT EXISTS "entitlement_grants_tier_ends_at_idx"
  ON "entitlement_grants"("tier", "ends_at");
