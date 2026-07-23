-- CreateEnum
CREATE TYPE "RecipeSourceKind" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('ACTIVE', 'RECYCLED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "RecipeReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "DiningEventStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiningEventParticipantSource" AS ENUM ('DINING_GROUP', 'SHARE');

-- CreateEnum
CREATE TYPE "DiningEventParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ShoppingStatus" AS ENUM ('OPEN', 'BOUGHT', 'DELETED');

-- CreateEnum
CREATE TYPE "ShoppingSourceType" AS ENUM ('MANUAL', 'PLAN', 'EVENT', 'BRING');

-- CreateEnum
CREATE TYPE "StorageLedgerModule" AS ENUM ('RECIPE', 'FRIDGE', 'MEAL', 'SHOPPING', 'MEAL_GUEST', 'TECHNICAL_SNAPSHOT', 'RECYCLE_BIN', 'PROFILE_ASSET');

-- DropForeignKey
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_dining_group_id_fkey";

-- DropForeignKey
ALTER TABLE "dining_group_invites" DROP CONSTRAINT "dining_group_invites_accepted_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "idempotency_records" DROP CONSTRAINT "idempotency_records_dining_group_id_fkey";

-- DropIndex
DROP INDEX "dining_groups_id_owner_id_key";

-- AlterTable
ALTER TABLE "admin_accounts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dining_group_invites" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dining_group_members" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dining_groups" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "entitlement_grants" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "tier" DROP DEFAULT;

-- AlterTable
ALTER TABLE "idempotency_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "home_background_url" VARCHAR(512),
ADD COLUMN     "profile_background_url" VARCHAR(512),
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "recipe_content_versions" (
    "id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "ingredients_json" JSONB NOT NULL,
    "steps_json" JSONB NOT NULL,
    "servings" VARCHAR(64),
    "duration_minutes" INTEGER,
    "images_json" JSONB NOT NULL,
    "search_text" TEXT NOT NULL,
    "content_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "source_kind" "RecipeSourceKind" NOT NULL,
    "source_recipe_id" UUID,
    "base_version_id" UUID NOT NULL,
    "independent_version_id" UUID,
    "override_json" JSONB,
    "hidden_base_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_customized" BOOLEAN NOT NULL DEFAULT false,
    "title" VARCHAR(120) NOT NULL,
    "search_text" TEXT NOT NULL,
    "cover_image_url" VARCHAR(512),
    "status" "RecipeStatus" NOT NULL DEFAULT 'ACTIVE',
    "blocked_reason" VARCHAR(255),
    "blocked_at" TIMESTAMPTZ(3),
    "recycled_until" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_reports" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" "RecipeReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" VARCHAR(255),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_date" DATE NOT NULL,
    "meal_slot" "MealSlot" NOT NULL,
    "recipe_id" UUID,
    "recipe_version_id" UUID NOT NULL,
    "menu_snapshot" JSONB NOT NULL,
    "note" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meal_plan_item_id" UUID,
    "dining_group_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(255),
    "status" "DiningEventStatus" NOT NULL DEFAULT 'PLANNED',
    "menu_snapshot" JSONB NOT NULL,
    "share_token_hash" VARCHAR(128),
    "share_token_expires_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dining_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_event_participants" (
    "id" UUID NOT NULL,
    "dining_event_id" UUID NOT NULL,
    "user_id" UUID,
    "guest_name" VARCHAR(120),
    "source_type" "DiningEventParticipantSource" NOT NULL,
    "status" "DiningEventParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "bring_recipe_id" UUID,
    "bring_version_id" UUID,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dining_event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fridge_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "quantity_text" VARCHAR(64),
    "note" VARCHAR(255),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "consumed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fridge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "quantity_text" VARCHAR(64),
    "note" VARCHAR(255),
    "source_type" "ShoppingSourceType" NOT NULL,
    "source_key" VARCHAR(120),
    "status" "ShoppingStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module" "StorageLedgerModule" NOT NULL,
    "record_key" VARCHAR(160) NOT NULL,
    "used_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "storage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_content_versions_name_idx" ON "recipe_content_versions"("name");

-- CreateIndex
CREATE INDEX "recipe_content_versions_created_by_user_id_created_at_idx" ON "recipe_content_versions"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "recipes_owner_id_status_updated_at_idx" ON "recipes"("owner_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "recipes_source_kind_status_updated_at_idx" ON "recipes"("source_kind", "status", "updated_at");

-- CreateIndex
CREATE INDEX "recipes_source_recipe_id_base_version_id_owner_id_status_idx" ON "recipes"("source_recipe_id", "base_version_id", "owner_id", "status");

-- CreateIndex
CREATE INDEX "recipe_reports_status_created_at_idx" ON "recipe_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "recipe_reports_recipe_id_status_idx" ON "recipe_reports"("recipe_id", "status");

-- CreateIndex
CREATE INDEX "meal_plan_items_user_id_plan_date_idx" ON "meal_plan_items"("user_id", "plan_date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_items_user_id_plan_date_meal_slot_key" ON "meal_plan_items"("user_id", "plan_date", "meal_slot");

-- CreateIndex
CREATE UNIQUE INDEX "dining_events_meal_plan_item_id_key" ON "dining_events"("meal_plan_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "dining_events_share_token_hash_key" ON "dining_events"("share_token_hash");

-- CreateIndex
CREATE INDEX "dining_events_user_id_scheduled_at_idx" ON "dining_events"("user_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "dining_events_dining_group_id_scheduled_at_idx" ON "dining_events"("dining_group_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "dining_event_participants_dining_event_id_status_idx" ON "dining_event_participants"("dining_event_id", "status");

-- CreateIndex
CREATE INDEX "dining_event_participants_user_id_status_idx" ON "dining_event_participants"("user_id", "status");

-- CreateIndex
CREATE INDEX "fridge_items_user_id_available_updated_at_idx" ON "fridge_items"("user_id", "available", "updated_at");

-- CreateIndex
CREATE INDEX "fridge_items_user_id_name_idx" ON "fridge_items"("user_id", "name");

-- CreateIndex
CREATE INDEX "shopping_items_user_id_status_updated_at_idx" ON "shopping_items"("user_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "shopping_items_user_id_source_type_source_key_idx" ON "shopping_items"("user_id", "source_type", "source_key");

-- CreateIndex
CREATE INDEX "storage_ledger_user_id_module_idx" ON "storage_ledger"("user_id", "module");

-- CreateIndex
CREATE UNIQUE INDEX "storage_ledger_user_id_module_record_key_key" ON "storage_ledger"("user_id", "module", "record_key");

-- AddForeignKey
ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_content_versions" ADD CONSTRAINT "recipe_content_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_recipe_id_fkey" FOREIGN KEY ("source_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_independent_version_id_fkey" FOREIGN KEY ("independent_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_reports" ADD CONSTRAINT "recipe_reports_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_reports" ADD CONSTRAINT "recipe_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_events" ADD CONSTRAINT "dining_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_events" ADD CONSTRAINT "dining_events_meal_plan_item_id_fkey" FOREIGN KEY ("meal_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_events" ADD CONSTRAINT "dining_events_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_event_participants" ADD CONSTRAINT "dining_event_participants_dining_event_id_fkey" FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_event_participants" ADD CONSTRAINT "dining_event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_event_participants" ADD CONSTRAINT "dining_event_participants_bring_recipe_id_fkey" FOREIGN KEY ("bring_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_event_participants" ADD CONSTRAINT "dining_event_participants_bring_version_id_fkey" FOREIGN KEY ("bring_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fridge_items" ADD CONSTRAINT "fridge_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_ledger" ADD CONSTRAINT "storage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idempotency_records_operation_id_operation_type_user_id_dining_" RENAME TO "idempotency_records_operation_id_operation_type_user_id_din_idx";
