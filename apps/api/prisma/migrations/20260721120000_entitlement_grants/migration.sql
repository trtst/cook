CREATE TABLE "entitlement_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "dining_group_id" UUID,
  "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_entitlement_grants_subject" CHECK (
    ("user_id" IS NOT NULL AND "dining_group_id" IS NULL)
    OR ("user_id" IS NULL AND "dining_group_id" IS NOT NULL)
  ),
  CONSTRAINT "ck_entitlement_grants_period" CHECK (
    "ends_at" IS NULL OR "ends_at" > "starts_at"
  )
);

CREATE UNIQUE INDEX "entitlement_grants_user_id_key" ON "entitlement_grants"("user_id");
CREATE UNIQUE INDEX "entitlement_grants_dining_group_id_key" ON "entitlement_grants"("dining_group_id");

ALTER TABLE "entitlement_grants"
  ADD CONSTRAINT "entitlement_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "entitlement_grants"
  ADD CONSTRAINT "entitlement_grants_dining_group_id_fkey"
  FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
