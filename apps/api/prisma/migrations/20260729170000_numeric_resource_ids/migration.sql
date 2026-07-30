-- Reset UUID resource keys to numeric IDs.
-- Existing pre-release data is intentionally discarded for this migration.

DROP TABLE IF EXISTS "admin_accounts", "users", "user_taste_profiles", "dining_groups", "dining_group_members", "dining_group_invites", "entitlement_grants", "recipe_categories", "recipe_scenes", "inspiration_categories", "ingredient_categories", "units", "ingredients", "ingredient_recommendations", "recipe_content_versions", "recipes", "recipe_scene_links", "recipe_collections", "recipe_collection_scenes", "recipe_drafts", "recipe_draft_scenes", "recipe_reports", "meal_plan_items", "dining_events", "dining_event_participants", "fridge_items", "shopping_items", "storage_ledger", "idempotency_records", "audit_events", "outbox_events" CASCADE;
DROP TYPE IF EXISTS "AdminAccountStatus", "UserStatus", "DiningGroupStatus", "DiningGroupRole", "LongTermMemberStatus", "LongTermMemberStatusReason", "DiningGroupInviteStatus", "IdempotencyStatus", "AuditActorType", "OutboxStatus", "RecipeStatus", "RecipeDifficulty", "RecipeDuration", "RecipeReportStatus", "UnitType", "IngredientStatus", "IngredientRecommendationStatus", "MealSlot", "DiningEventStatus", "DiningEventParticipantSource", "DiningEventParticipantStatus", "ShoppingStatus", "ShoppingSourceType", "StorageLedgerModule", "EntitlementTier" CASCADE;

-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DiningGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DiningGroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "LongTermMemberStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'ENDED');

-- CreateEnum
CREATE TYPE "LongTermMemberStatusReason" AS ENUM ('LEFT', 'REMOVED', 'USER_OVER_LIMIT', 'OWNER_OVER_LIMIT', 'GROUP_DISSOLVED');

-- CreateEnum
CREATE TYPE "DiningGroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('ACTIVE', 'RECYCLED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('BEGINNER', 'EASY', 'SKILLED', 'CHALLENGING');

-- CreateEnum
CREATE TYPE "RecipeDuration" AS ENUM ('WITHIN_15', 'BETWEEN_15_30', 'BETWEEN_30_60', 'OVER_60');

-- CreateEnum
CREATE TYPE "RecipeReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'SHAPE', 'CONTAINER', 'PACKAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "IngredientStatus" AS ENUM ('ACTIVE', 'DISABLED', 'MERGED');

-- CreateEnum
CREATE TYPE "IngredientRecommendationStatus" AS ENUM ('PENDING', 'REJECTED', 'ADOPTED', 'MERGED');

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

-- CreateEnum
CREATE TYPE "EntitlementTier" AS ENUM ('FREE', 'PLUS', 'PRO', 'ULTRA');

-- CreateTable
CREATE TABLE "admin_accounts" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(64) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY['SUPER_ADMIN']::TEXT[],
    "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "uid" INTEGER NOT NULL,
    "nickname" VARCHAR(64),
    "avatar_url" VARCHAR(512),
    "profile_background_url" VARCHAR(512),
    "home_background_url" VARCHAR(512),
    "phone" VARCHAR(32),
    "password_hash" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_taste_profiles" (
    "user_id" INTEGER NOT NULL,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strict_dislikes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disliked_ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flavor_preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" VARCHAR(1000),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_taste_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "dining_groups" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "status" "DiningGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dining_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_group_members" (
    "id" SERIAL NOT NULL,
    "dining_group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "DiningGroupRole" NOT NULL,
    "status" "LongTermMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_reason" "LongTermMemberStatusReason",
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restricted_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dining_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_group_invites" (
    "id" SERIAL NOT NULL,
    "dining_group_id" INTEGER NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "accepted_by_user_id" INTEGER,
    "token_hash" VARCHAR(128) NOT NULL,
    "status" "DiningGroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dining_group_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grants" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tier" "EntitlementTier" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_categories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "search_key" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_scenes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "search_key" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspiration_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon_key" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inspiration_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_categories" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon_key" VARCHAR(64),
    "is_selectable" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredient_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "type" "UnitType" NOT NULL,
    "name" VARCHAR(16) NOT NULL,
    "search_key" VARCHAR(32) NOT NULL,
    "system_sort_order" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "category_id" INTEGER NOT NULL,
    "default_unit_id" INTEGER NOT NULL,
    "merged_to_id" INTEGER,
    "name" VARCHAR(64) NOT NULL,
    "search_key" VARCHAR(80) NOT NULL,
    "status" "IngredientStatus" NOT NULL DEFAULT 'ACTIVE',
    "system_sort_order" INTEGER,
    "image_updated_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_recommendations" (
    "id" SERIAL NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "IngredientRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "ingredient_name" VARCHAR(64) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "category_name" VARCHAR(20) NOT NULL,
    "default_unit_id" INTEGER NOT NULL,
    "default_unit_name" VARCHAR(16) NOT NULL,
    "review_note" VARCHAR(255),
    "review_reason_code" VARCHAR(32),
    "review_advice" VARCHAR(255),
    "target_ingredient_id" INTEGER,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredient_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_content_versions" (
    "id" SERIAL NOT NULL,
    "created_by_user_id" INTEGER,
    "name" VARCHAR(120) NOT NULL,
    "story" VARCHAR(2000),
    "base_servings" INTEGER NOT NULL,
    "difficulty" "RecipeDifficulty",
    "duration" "RecipeDuration",
    "tips" VARCHAR(1000),
    "ingredients_json" JSONB NOT NULL,
    "steps_json" JSONB NOT NULL,
    "images_json" JSONB NOT NULL,
    "search_text" TEXT NOT NULL,
    "content_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "category_id" INTEGER,
    "inspiration_category_id" INTEGER,
    "current_version_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "search_text" TEXT NOT NULL,
    "cover_image_url" VARCHAR(512),
    "status" "RecipeStatus" NOT NULL DEFAULT 'ACTIVE',
    "blocked_reason" VARCHAR(255),
    "blocked_at" TIMESTAMPTZ(3),
    "recycled_until" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "collect_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_scene_links" (
    "recipe_id" INTEGER NOT NULL,
    "scene_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_scene_links_pkey" PRIMARY KEY ("recipe_id","scene_id")
);

-- CreateTable
CREATE TABLE "recipe_collections" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source_recipe_id" INTEGER NOT NULL,
    "source_version_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_collection_scenes" (
    "collection_id" INTEGER NOT NULL,
    "scene_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_collection_scenes_pkey" PRIMARY KEY ("collection_id","scene_id")
);

-- CreateTable
CREATE TABLE "recipe_drafts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "category_id" INTEGER,
    "title" VARCHAR(120),
    "search_text" TEXT NOT NULL,
    "content_json" JSONB NOT NULL,
    "content_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_draft_scenes" (
    "draft_id" INTEGER NOT NULL,
    "scene_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_draft_scenes_pkey" PRIMARY KEY ("draft_id","scene_id")
);

-- CreateTable
CREATE TABLE "recipe_reports" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "reporter_id" INTEGER NOT NULL,
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
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan_date" DATE NOT NULL,
    "meal_slot" "MealSlot" NOT NULL,
    "recipe_id" INTEGER,
    "recipe_version_id" INTEGER NOT NULL,
    "menu_snapshot" JSONB NOT NULL,
    "note" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "meal_plan_item_id" INTEGER,
    "dining_group_id" INTEGER,
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
    "id" SERIAL NOT NULL,
    "dining_event_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "guest_name" VARCHAR(120),
    "source_type" "DiningEventParticipantSource" NOT NULL,
    "status" "DiningEventParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "bring_recipe_id" INTEGER,
    "bring_version_id" INTEGER,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dining_event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fridge_items" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
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
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
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
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "module" "StorageLedgerModule" NOT NULL,
    "record_key" VARCHAR(160) NOT NULL,
    "used_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "storage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" SERIAL NOT NULL,
    "operation_id" VARCHAR(64) NOT NULL,
    "operation_type" VARCHAR(64) NOT NULL,
    "user_id" INTEGER,
    "admin_id" INTEGER,
    "dining_group_id" INTEGER,
    "request_hash" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "result_json" JSONB,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" SERIAL NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_user_id" INTEGER,
    "actor_admin_id" INTEGER,
    "action" VARCHAR(64) NOT NULL,
    "object_type" VARCHAR(64) NOT NULL,
    "object_id" INTEGER,
    "dining_group_id" INTEGER,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" SERIAL NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "aggregate_type" VARCHAR(64) NOT NULL,
    "aggregate_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_username_key" ON "admin_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_uid_key" ON "users"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dining_groups_owner_id_key" ON "dining_groups"("owner_id");

-- CreateIndex
CREATE INDEX "dining_groups_status_created_at_idx" ON "dining_groups"("status", "created_at");

-- CreateIndex
CREATE INDEX "dining_groups_name_idx" ON "dining_groups"("name");

-- CreateIndex
CREATE INDEX "dining_group_members_dining_group_id_status_idx" ON "dining_group_members"("dining_group_id", "status");

-- CreateIndex
CREATE INDEX "dining_group_members_user_id_status_idx" ON "dining_group_members"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dining_group_members_dining_group_id_user_id_key" ON "dining_group_members"("dining_group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dining_group_invites_token_hash_key" ON "dining_group_invites"("token_hash");

-- CreateIndex
CREATE INDEX "dining_group_invites_dining_group_id_status_idx" ON "dining_group_invites"("dining_group_id", "status");

-- CreateIndex
CREATE INDEX "dining_group_invites_token_hash_status_expires_at_idx" ON "dining_group_invites"("token_hash", "status", "expires_at");

-- CreateIndex
CREATE INDEX "dining_group_invites_expires_at_idx" ON "dining_group_invites"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_grants_user_id_key" ON "entitlement_grants"("user_id");

-- CreateIndex
CREATE INDEX "entitlement_grants_tier_ends_at_idx" ON "entitlement_grants"("tier", "ends_at");

-- CreateIndex
CREATE INDEX "recipe_categories_user_id_sort_order_id_idx" ON "recipe_categories"("user_id", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_categories_user_id_search_key_key" ON "recipe_categories"("user_id", "search_key");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_categories_user_id_sort_order_key" ON "recipe_categories"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "recipe_scenes_user_id_sort_order_id_idx" ON "recipe_scenes"("user_id", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_scenes_user_id_search_key_key" ON "recipe_scenes"("user_id", "search_key");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_scenes_user_id_sort_order_key" ON "recipe_scenes"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "inspiration_categories_sort_order_id_idx" ON "inspiration_categories"("sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_categories_name_key" ON "inspiration_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_categories_sort_order_key" ON "inspiration_categories"("sort_order");

-- CreateIndex
CREATE INDEX "ingredient_categories_sort_order_id_idx" ON "ingredient_categories"("sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_code_key" ON "ingredient_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_name_key" ON "ingredient_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_sort_order_key" ON "ingredient_categories"("sort_order");

-- CreateIndex
CREATE INDEX "units_owner_id_type_search_key_id_idx" ON "units"("owner_id", "type", "search_key", "id");

-- CreateIndex
CREATE INDEX "units_owner_id_type_system_sort_order_id_idx" ON "units"("owner_id", "type", "system_sort_order", "id");

-- CreateIndex
CREATE INDEX "ingredients_owner_id_status_category_id_system_sort_order_i_idx" ON "ingredients"("owner_id", "status", "category_id", "system_sort_order", "id");

-- CreateIndex
CREATE INDEX "ingredients_owner_id_status_category_id_search_key_id_idx" ON "ingredients"("owner_id", "status", "category_id", "search_key", "id");

-- CreateIndex
CREATE INDEX "ingredient_recommendations_user_id_created_at_idx" ON "ingredient_recommendations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ingredient_recommendations_ingredient_id_created_at_idx" ON "ingredient_recommendations"("ingredient_id", "created_at");

-- CreateIndex
CREATE INDEX "ingredient_recommendations_status_created_at_idx" ON "ingredient_recommendations"("status", "created_at");

-- CreateIndex
CREATE INDEX "recipe_content_versions_name_idx" ON "recipe_content_versions"("name");

-- CreateIndex
CREATE INDEX "recipe_content_versions_created_by_user_id_created_at_idx" ON "recipe_content_versions"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "recipes_owner_id_status_category_id_sort_order_id_idx" ON "recipes"("owner_id", "status", "category_id", "sort_order", "id");

-- CreateIndex
CREATE INDEX "recipes_inspiration_category_id_status_updated_at_id_idx" ON "recipes"("inspiration_category_id", "status", "updated_at", "id");

-- CreateIndex
CREATE INDEX "recipes_owner_id_status_updated_at_idx" ON "recipes"("owner_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "recipe_scene_links_scene_id_recipe_id_idx" ON "recipe_scene_links"("scene_id", "recipe_id");

-- CreateIndex
CREATE INDEX "recipe_collections_user_id_updated_at_id_idx" ON "recipe_collections"("user_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "recipe_collections_source_recipe_id_user_id_id_idx" ON "recipe_collections"("source_recipe_id", "user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_collections_user_id_source_recipe_id_source_version__key" ON "recipe_collections"("user_id", "source_recipe_id", "source_version_id");

-- CreateIndex
CREATE INDEX "recipe_collection_scenes_scene_id_collection_id_idx" ON "recipe_collection_scenes"("scene_id", "collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_drafts_recipe_id_key" ON "recipe_drafts"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_drafts_user_id_updated_at_id_idx" ON "recipe_drafts"("user_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "recipe_draft_scenes_scene_id_draft_id_idx" ON "recipe_draft_scenes"("scene_id", "draft_id");

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

-- CreateIndex
CREATE INDEX "idempotency_records_user_id_operation_type_idx" ON "idempotency_records"("user_id", "operation_type");

-- CreateIndex
CREATE INDEX "idempotency_records_admin_id_operation_type_idx" ON "idempotency_records"("admin_id", "operation_type");

-- CreateIndex
CREATE INDEX "idempotency_records_dining_group_id_operation_type_idx" ON "idempotency_records"("dining_group_id", "operation_type");

-- CreateIndex
CREATE INDEX "idempotency_records_operation_id_operation_type_user_id_din_idx" ON "idempotency_records"("operation_id", "operation_type", "user_id", "dining_group_id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_type_actor_user_id_created_at_idx" ON "audit_events"("actor_type", "actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_type_actor_admin_id_created_at_idx" ON "audit_events"("actor_type", "actor_admin_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_object_type_object_id_idx" ON "audit_events"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "audit_events_dining_group_id_created_at_idx" ON "audit_events"("dining_group_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_run_at_idx" ON "outbox_events"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_groups" ADD CONSTRAINT "dining_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_group_members" ADD CONSTRAINT "dining_group_members_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_group_members" ADD CONSTRAINT "dining_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_group_invites" ADD CONSTRAINT "dining_group_invites_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_scenes" ADD CONSTRAINT "recipe_scenes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ingredient_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_merged_to_id_fkey" FOREIGN KEY ("merged_to_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_recommendations" ADD CONSTRAINT "ingredient_recommendations_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_recommendations" ADD CONSTRAINT "ingredient_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_recommendations" ADD CONSTRAINT "ingredient_recommendations_target_ingredient_id_fkey" FOREIGN KEY ("target_ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_content_versions" ADD CONSTRAINT "recipe_content_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "recipe_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_inspiration_category_id_fkey" FOREIGN KEY ("inspiration_category_id") REFERENCES "inspiration_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_scene_links" ADD CONSTRAINT "recipe_scene_links_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_scene_links" ADD CONSTRAINT "recipe_scene_links_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "recipe_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_source_recipe_id_fkey" FOREIGN KEY ("source_recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_collection_scenes" ADD CONSTRAINT "recipe_collection_scenes_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "recipe_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_collection_scenes" ADD CONSTRAINT "recipe_collection_scenes_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "recipe_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "recipe_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_draft_scenes" ADD CONSTRAINT "recipe_draft_scenes_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "recipe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_draft_scenes" ADD CONSTRAINT "recipe_draft_scenes_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "recipe_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_admin_id_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_dining_group_id_fkey" FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
