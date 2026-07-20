-- 当前项目尚未上线，本迁移直接重建饭搭子业务表，不保留旧脚手架数据。
DROP TABLE IF EXISTS "idempotency_records" CASCADE;
DROP TABLE IF EXISTS "dining_group_invites" CASCADE;
DROP TABLE IF EXISTS "dining_group_members" CASCADE;
DROP TABLE IF EXISTS "dining_groups" CASCADE;

DROP TYPE IF EXISTS "MemberStatus";
DROP TYPE IF EXISTS "CollaborationMode";
DROP TYPE IF EXISTS "SharedQuotaPolicy";
DROP TYPE IF EXISTS "DiningGroupStatus";

CREATE TYPE "DiningGroupStatus" AS ENUM ('ACTIVE', 'FROZEN', 'ARCHIVED');
CREATE TYPE "LongTermMemberStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'ENDED');
CREATE TYPE "LongTermMemberStatusReason" AS ENUM ('LEFT', 'REMOVED', 'GROUP_DOWNGRADED', 'GROUP_DISSOLVED');
CREATE TYPE "DiningGroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');
CREATE TYPE "CarryBackSnapshotStatus" AS ENUM ('AVAILABLE', 'EXPIRED', 'DELETED', 'INVALIDATED');
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "dining_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(80) NOT NULL,
  "owner_id" UUID NOT NULL,
  "status" "DiningGroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "frozen_at" TIMESTAMPTZ(3),
  "archived_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dining_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_dining_groups_status_time" CHECK (
    ("status" = 'ACTIVE' AND "frozen_at" IS NULL AND "archived_at" IS NULL)
    OR ("status" = 'FROZEN' AND "frozen_at" IS NOT NULL AND "archived_at" IS NULL)
    OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
  ),
  CONSTRAINT "ck_dining_groups_version" CHECK ("version" > 0)
);

CREATE TABLE "dining_group_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dining_group_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "DiningGroupRole" NOT NULL,
  "status" "LongTermMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "status_reason" "LongTermMemberStatusReason",
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restricted_at" TIMESTAMPTZ(3),
  "ended_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dining_group_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_dining_group_members_state" CHECK (
    ("status" = 'ACTIVE' AND "status_reason" IS NULL AND "restricted_at" IS NULL AND "ended_at" IS NULL)
    OR ("status" = 'RESTRICTED' AND "status_reason" = 'GROUP_DOWNGRADED' AND "restricted_at" IS NOT NULL AND "ended_at" IS NULL)
    OR ("status" = 'ENDED' AND "status_reason" IS NOT NULL AND "ended_at" IS NOT NULL)
  ),
  CONSTRAINT "ck_dining_group_members_version" CHECK ("version" > 0)
);

CREATE TABLE "user_spaces" (
  "user_id" UUID NOT NULL,
  "original_dining_group_id" UUID NOT NULL,
  "current_dining_group_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_spaces_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "ck_user_spaces_version" CHECK ("version" > 0)
);

CREATE TABLE "dining_group_invites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dining_group_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "accepted_by_user_id" UUID,
  "token_hash" VARCHAR(128) NOT NULL,
  "status" "DiningGroupInviteStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "policy_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dining_group_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_dining_group_invites_state" CHECK (
    ("status" = 'ACCEPTED' AND "accepted_by_user_id" IS NOT NULL AND "accepted_at" IS NOT NULL)
    OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL)
    OR ("status" IN ('PENDING', 'DECLINED', 'EXPIRED') AND "accepted_at" IS NULL AND "revoked_at" IS NULL)
  ),
  CONSTRAINT "ck_dining_group_invites_expiry" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "ck_dining_group_invites_policy" CHECK ("policy_version" > 0)
);

CREATE TABLE "carry_back_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "source_dining_group_id" UUID NOT NULL,
  "target_dining_group_id" UUID NOT NULL,
  "source_dining_group_name" VARCHAR(80) NOT NULL,
  "status" "CarryBackSnapshotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "policy_version" INTEGER NOT NULL DEFAULT 1,
  "recipe_count" INTEGER NOT NULL DEFAULT 0,
  "fridge_item_count" INTEGER NOT NULL DEFAULT 0,
  "shopping_item_count" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(3),
  "invalidated_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "carry_back_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_carry_back_snapshots_counts" CHECK (
    "recipe_count" >= 0 AND "fridge_item_count" >= 0 AND "shopping_item_count" >= 0
  ),
  CONSTRAINT "ck_carry_back_snapshots_expiry" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "ck_carry_back_snapshots_policy" CHECK ("policy_version" > 0),
  CONSTRAINT "ck_carry_back_snapshots_state" CHECK (
    ("status" = 'DELETED' AND "deleted_at" IS NOT NULL)
    OR ("status" = 'INVALIDATED' AND "invalidated_at" IS NOT NULL)
    OR ("status" IN ('AVAILABLE', 'EXPIRED') AND "deleted_at" IS NULL AND "invalidated_at" IS NULL)
  )
);

CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operation_id" UUID NOT NULL,
  "operation_type" VARCHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "dining_group_id" UUID,
  "request_hash" VARCHAR(64) NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "result_json" JSONB,
  "expires_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_idempotency_records_result" CHECK (
    ("status" = 'SUCCEEDED' AND "result_json" IS NOT NULL)
    OR "status" IN ('PROCESSING', 'FAILED')
  )
);

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_type" "AuditActorType" NOT NULL,
  "actor_user_id" UUID,
  "action" VARCHAR(64) NOT NULL,
  "object_type" VARCHAR(64) NOT NULL,
  "object_id" UUID,
  "dining_group_id" UUID,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(64) NOT NULL,
  "aggregate_type" VARCHAR(64) NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "next_run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "done_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_outbox_events_retry" CHECK ("retry_count" >= 0)
);

CREATE UNIQUE INDEX "dining_groups_owner_id_key" ON "dining_groups"("owner_id");
CREATE UNIQUE INDEX "dining_groups_id_owner_id_key" ON "dining_groups"("id", "owner_id");
CREATE INDEX "dining_groups_status_created_at_idx" ON "dining_groups"("status", "created_at");
CREATE INDEX "dining_groups_name_idx" ON "dining_groups"("name");

CREATE UNIQUE INDEX "dining_group_members_dining_group_id_user_id_key" ON "dining_group_members"("dining_group_id", "user_id");
CREATE UNIQUE INDEX "uq_dining_group_members_owner" ON "dining_group_members"("dining_group_id")
  WHERE "role" = 'OWNER' AND "status" <> 'ENDED';
CREATE INDEX "dining_group_members_dining_group_id_status_idx" ON "dining_group_members"("dining_group_id", "status");
CREATE INDEX "dining_group_members_user_id_status_idx" ON "dining_group_members"("user_id", "status");

CREATE UNIQUE INDEX "user_spaces_original_dining_group_id_key" ON "user_spaces"("original_dining_group_id");
CREATE INDEX "user_spaces_current_dining_group_id_idx" ON "user_spaces"("current_dining_group_id");

CREATE UNIQUE INDEX "dining_group_invites_token_hash_key" ON "dining_group_invites"("token_hash");
CREATE INDEX "dining_group_invites_dining_group_id_status_idx" ON "dining_group_invites"("dining_group_id", "status");
CREATE INDEX "dining_group_invites_expires_at_idx" ON "dining_group_invites"("expires_at");

CREATE UNIQUE INDEX "uq_carry_back_snapshots_available" ON "carry_back_snapshots"("user_id", "source_dining_group_id")
  WHERE "status" = 'AVAILABLE';
CREATE INDEX "carry_back_snapshots_user_id_status_expires_at_idx" ON "carry_back_snapshots"("user_id", "status", "expires_at");
CREATE INDEX "carry_back_snapshots_source_dining_group_id_idx" ON "carry_back_snapshots"("source_dining_group_id");

CREATE UNIQUE INDEX "uq_idempotency_user_scope" ON "idempotency_records"("operation_id", "operation_type", "user_id")
  WHERE "dining_group_id" IS NULL;
CREATE UNIQUE INDEX "uq_idempotency_dining_group_scope" ON "idempotency_records"("operation_id", "operation_type", "user_id", "dining_group_id")
  WHERE "dining_group_id" IS NOT NULL;
CREATE INDEX "idempotency_records_user_id_operation_type_idx" ON "idempotency_records"("user_id", "operation_type");
CREATE INDEX "idempotency_records_dining_group_id_operation_type_idx" ON "idempotency_records"("dining_group_id", "operation_type");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

CREATE INDEX "audit_events_actor_type_actor_user_id_created_at_idx" ON "audit_events"("actor_type", "actor_user_id", "created_at");
CREATE INDEX "audit_events_object_type_object_id_idx" ON "audit_events"("object_type", "object_id");
CREATE INDEX "audit_events_dining_group_id_created_at_idx" ON "audit_events"("dining_group_id", "created_at");

CREATE INDEX "outbox_events_status_next_run_at_idx" ON "outbox_events"("status", "next_run_at");
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

ALTER TABLE "dining_groups" ADD CONSTRAINT "dining_groups_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dining_group_members" ADD CONSTRAINT "dining_group_members_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dining_group_members" ADD CONSTRAINT "dining_group_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_spaces" ADD CONSTRAINT "user_spaces_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_spaces" ADD CONSTRAINT "user_spaces_original_dining_group_id_fkey"
  FOREIGN KEY ("original_dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_spaces" ADD CONSTRAINT "user_spaces_current_dining_group_id_fkey"
  FOREIGN KEY ("current_dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_spaces" ADD CONSTRAINT "user_spaces_original_owner_fkey"
  FOREIGN KEY ("original_dining_group_id", "user_id") REFERENCES "dining_groups"("id", "owner_id")
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "user_spaces" ADD CONSTRAINT "user_spaces_current_member_fkey"
  FOREIGN KEY ("current_dining_group_id", "user_id") REFERENCES "dining_group_members"("dining_group_id", "user_id")
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_accepted_by_user_id_fkey"
  FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "carry_back_snapshots" ADD CONSTRAINT "carry_back_snapshots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carry_back_snapshots" ADD CONSTRAINT "carry_back_snapshots_source_dining_group_id_fkey"
  FOREIGN KEY ("source_dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carry_back_snapshots" ADD CONSTRAINT "carry_back_snapshots_target_dining_group_id_fkey"
  FOREIGN KEY ("target_dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_current_user_space()
RETURNS trigger AS $$
DECLARE
  target_user_id UUID;
  target_dining_group_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'dining_groups' THEN
    target_dining_group_id := COALESCE(NEW.id, OLD.id);

    IF EXISTS (
      SELECT 1
      FROM "user_spaces" us
      JOIN "dining_groups" dg ON dg."id" = us."current_dining_group_id"
      JOIN "dining_group_members" dgm
        ON dgm."dining_group_id" = us."current_dining_group_id"
        AND dgm."user_id" = us."user_id"
      WHERE us."current_dining_group_id" = target_dining_group_id
        AND (dg."status" <> 'ACTIVE' OR dgm."status" = 'ENDED')
    ) THEN
      RAISE EXCEPTION 'current user space must reference an active dining group and a non-ended membership';
    END IF;

    RETURN COALESCE(NEW, OLD);
  END IF;

  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF EXISTS (
    SELECT 1
    FROM "user_spaces" us
    JOIN "dining_groups" dg ON dg."id" = us."current_dining_group_id"
    JOIN "dining_group_members" dgm
      ON dgm."dining_group_id" = us."current_dining_group_id"
      AND dgm."user_id" = us."user_id"
    WHERE us."user_id" = target_user_id
      AND (dg."status" <> 'ACTIVE' OR dgm."status" = 'ENDED')
  ) THEN
    RAISE EXCEPTION 'current user space must reference an active dining group and a non-ended membership';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_validate_user_spaces_current"
AFTER INSERT OR UPDATE ON "user_spaces"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_current_user_space();

CREATE CONSTRAINT TRIGGER "trg_validate_members_current"
AFTER UPDATE OR DELETE ON "dining_group_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_current_user_space();

CREATE CONSTRAINT TRIGGER "trg_validate_groups_current"
AFTER UPDATE OF "status" ON "dining_groups"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_current_user_space();
