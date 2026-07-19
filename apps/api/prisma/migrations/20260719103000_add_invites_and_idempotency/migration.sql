CREATE TABLE "dining_group_invites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dining_group_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "dining_group_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operation_id" UUID NOT NULL,
  "operation_type" VARCHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "dining_group_id" UUID NOT NULL,
  "result_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dining_group_invites_token_hash_key" ON "dining_group_invites"("token_hash");
CREATE INDEX "dining_group_invites_dining_group_id_status_idx" ON "dining_group_invites"("dining_group_id", "status");
CREATE INDEX "dining_group_invites_expires_at_idx" ON "dining_group_invites"("expires_at");

CREATE UNIQUE INDEX "idempotency_records_operation_id_operation_type_user_id_dining_group_id_key"
  ON "idempotency_records"("operation_id", "operation_type", "user_id", "dining_group_id");
CREATE INDEX "idempotency_records_user_id_operation_type_idx" ON "idempotency_records"("user_id", "operation_type");
CREATE INDEX "idempotency_records_dining_group_id_operation_type_idx" ON "idempotency_records"("dining_group_id", "operation_type");

ALTER TABLE "dining_group_invites"
  ADD CONSTRAINT "dining_group_invites_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dining_group_invites"
  ADD CONSTRAINT "dining_group_invites_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
