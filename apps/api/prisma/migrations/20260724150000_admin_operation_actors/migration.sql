ALTER TABLE "idempotency_records"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN "admin_id" UUID;

ALTER TABLE "audit_events"
  ADD COLUMN "actor_admin_id" UUID;

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ck_idempotency_records_actor" CHECK (
    ("user_id" IS NOT NULL AND "admin_id" IS NULL)
    OR ("user_id" IS NULL AND "admin_id" IS NOT NULL AND "dining_group_id" IS NULL)
  );

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_admin_id_fkey"
    FOREIGN KEY ("actor_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ck_audit_events_actor" CHECK (
    ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL AND "actor_admin_id" IS NULL)
    OR ("actor_type" = 'ADMIN' AND "actor_user_id" IS NULL AND "actor_admin_id" IS NOT NULL)
    OR ("actor_type" = 'SYSTEM' AND "actor_user_id" IS NULL AND "actor_admin_id" IS NULL)
  );

CREATE UNIQUE INDEX "uq_idempotency_admin_scope"
  ON "idempotency_records"("operation_id", "operation_type", "admin_id")
  WHERE "admin_id" IS NOT NULL;

CREATE INDEX "idempotency_records_admin_id_operation_type_idx"
  ON "idempotency_records"("admin_id", "operation_type");

CREATE INDEX "audit_events_actor_type_actor_admin_id_created_at_idx"
  ON "audit_events"("actor_type", "actor_admin_id", "created_at");
