CREATE TYPE "ShoppingListStatus" AS ENUM (
  'ACTIVE',
  'COMPLETED',
  'VOIDED'
);

CREATE TYPE "ShoppingListMemberRole" AS ENUM (
  'OWNER',
  'COLLABORATOR'
);

CREATE TABLE "shopping_lists" (
  "id" SERIAL NOT NULL,
  "owner_user_id" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "status" "ShoppingListStatus" NOT NULL DEFAULT 'ACTIVE',
  "completed_at" TIMESTAMPTZ(3),
  "voided_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_list_members" (
  "id" SERIAL NOT NULL,
  "list_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "role" "ShoppingListMemberRole" NOT NULL,
  "added_by_user_id" INTEGER NOT NULL,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shopping_list_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_share_tokens" (
  "id" SERIAL NOT NULL,
  "list_id" INTEGER NOT NULL,
  "token" VARCHAR(96) NOT NULL,
  "created_by_user_id" INTEGER NOT NULL,
  "disabled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shopping_share_tokens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fridge_items"
  ADD COLUMN "ingredient_id" INTEGER,
  ADD COLUMN "source_shopping_list_id" INTEGER,
  ADD COLUMN "source_shopping_item_id" INTEGER,
  ADD COLUMN "expire_at" TIMESTAMPTZ(3);

ALTER TABLE "shopping_items"
  ADD COLUMN "list_id" INTEGER,
  ADD COLUMN "checked_by_user_id" INTEGER,
  ADD COLUMN "checked_at" TIMESTAMPTZ(3),
  ADD COLUMN "removed_by_user_id" INTEGER,
  ADD COLUMN "removed_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "shopping_list_members_list_id_user_id_key"
ON "shopping_list_members"("list_id", "user_id");

CREATE UNIQUE INDEX "shopping_share_tokens_token_key"
ON "shopping_share_tokens"("token");

CREATE INDEX "shopping_lists_owner_user_id_status_updated_at_idx"
ON "shopping_lists"("owner_user_id", "status", "updated_at");

CREATE INDEX "shopping_list_members_user_id_joined_at_idx"
ON "shopping_list_members"("user_id", "joined_at");

CREATE INDEX "shopping_list_members_list_id_role_joined_at_idx"
ON "shopping_list_members"("list_id", "role", "joined_at");

CREATE INDEX "shopping_share_tokens_list_id_created_at_idx"
ON "shopping_share_tokens"("list_id", "created_at");

CREATE INDEX "shopping_share_tokens_token_disabled_at_idx"
ON "shopping_share_tokens"("token", "disabled_at");

CREATE INDEX "fridge_items_user_id_expire_at_updated_at_idx"
ON "fridge_items"("user_id", "expire_at", "updated_at");

CREATE INDEX "shopping_items_list_id_status_updated_at_idx"
ON "shopping_items"("list_id", "status", "updated_at");

ALTER TABLE "shopping_lists"
  ADD CONSTRAINT "shopping_lists_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_list_members"
  ADD CONSTRAINT "shopping_list_members_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_list_members"
  ADD CONSTRAINT "shopping_list_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_list_members"
  ADD CONSTRAINT "shopping_list_members_added_by_user_id_fkey"
  FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_share_tokens"
  ADD CONSTRAINT "shopping_share_tokens_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "shopping_share_tokens"
  ADD CONSTRAINT "shopping_share_tokens_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "fridge_items_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "fridge_items_source_shopping_list_id_fkey"
  FOREIGN KEY ("source_shopping_list_id") REFERENCES "shopping_lists"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "fridge_items_source_shopping_item_id_fkey"
  FOREIGN KEY ("source_shopping_item_id") REFERENCES "shopping_items"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "shopping_items_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "shopping_items_checked_by_user_id_fkey"
  FOREIGN KEY ("checked_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "shopping_items_removed_by_user_id_fkey"
  FOREIGN KEY ("removed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

UPDATE "shopping_items"
SET "checked_at" = "updated_at"
WHERE "status" = 'BOUGHT'
  AND "checked_at" IS NULL;

UPDATE "shopping_items"
SET "removed_at" = "updated_at"
WHERE "status" = 'DELETED'
  AND "removed_at" IS NULL;

WITH inserted AS (
  INSERT INTO "shopping_lists" (
    "owner_user_id",
    "name",
    "status",
    "version",
    "created_at",
    "updated_at"
  )
  SELECT DISTINCT
    "user_id",
    '旧待买清单',
    'ACTIVE'::"ShoppingListStatus",
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "shopping_items"
  WHERE "status" = 'OPEN'
  RETURNING "id", "owner_user_id"
)
INSERT INTO "shopping_list_members" (
  "list_id",
  "user_id",
  "role",
  "added_by_user_id",
  "joined_at"
)
SELECT
  "id",
  "owner_user_id",
  'OWNER'::"ShoppingListMemberRole",
  "owner_user_id",
  CURRENT_TIMESTAMP
FROM inserted;

UPDATE "shopping_items" AS si
SET "list_id" = sl."id"
FROM "shopping_lists" AS sl
WHERE si."status" = 'OPEN'
  AND si."list_id" IS NULL
  AND si."user_id" = sl."owner_user_id"
  AND sl."name" = '旧待买清单';
