CREATE TYPE "ShoppingListInviteStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'REVOKED'
);

CREATE TABLE "shopping_list_invites" (
  "id" SERIAL NOT NULL,
  "list_id" INTEGER NOT NULL,
  "target_user_id" INTEGER NOT NULL,
  "created_by_user_id" INTEGER NOT NULL,
  "accepted_by_user_id" INTEGER,
  "status" "ShoppingListInviteStatus" NOT NULL DEFAULT 'PENDING',
  "accepted_at" TIMESTAMPTZ(3),
  "declined_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shopping_list_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopping_list_invites_list_id_target_user_id_key"
ON "shopping_list_invites"("list_id", "target_user_id");

CREATE INDEX "shopping_list_invites_target_user_id_status_created_at_idx"
ON "shopping_list_invites"("target_user_id", "status", "created_at");

CREATE INDEX "shopping_list_invites_list_id_status_created_at_idx"
ON "shopping_list_invites"("list_id", "status", "created_at");

ALTER TABLE "shopping_list_invites"
  ADD CONSTRAINT "shopping_list_invites_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_list_invites"
  ADD CONSTRAINT "shopping_list_invites_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_list_invites"
  ADD CONSTRAINT "shopping_list_invites_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_list_invites"
  ADD CONSTRAINT "shopping_list_invites_accepted_by_user_id_fkey"
  FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
