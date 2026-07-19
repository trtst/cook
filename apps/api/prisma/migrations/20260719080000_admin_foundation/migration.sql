CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "RestaurantStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "RestaurantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED', 'LEFT');
CREATE TYPE "CollaborationMode" AS ENUM ('PERSONAL', 'SHARED');
CREATE TYPE "SharedQuotaPolicy" AS ENUM ('ALL_WRITERS', 'ADMINS_ONLY', 'OWNER_ONLY');

CREATE TABLE "admin_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "username" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(64) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY['SUPER_ADMIN']::TEXT[],
  "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nickname" VARCHAR(64),
  "avatar_url" VARCHAR(512),
  "phone" VARCHAR(32),
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(80) NOT NULL,
  "owner_id" UUID NOT NULL,
  "collaboration_mode" "CollaborationMode" NOT NULL DEFAULT 'PERSONAL',
  "shared_quota_policy" "SharedQuotaPolicy" NOT NULL DEFAULT 'ALL_WRITERS',
  "member_limit" INTEGER NOT NULL DEFAULT 4,
  "status" "RestaurantStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "RestaurantRole" NOT NULL,
  "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMPTZ(3),
  "invited_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "restaurant_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_accounts_username_key" ON "admin_accounts"("username");
CREATE INDEX "users_phone_idx" ON "users"("phone");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");
CREATE INDEX "restaurants_status_created_at_idx" ON "restaurants"("status", "created_at");
CREATE INDEX "restaurants_name_idx" ON "restaurants"("name");
CREATE INDEX "restaurants_owner_id_idx" ON "restaurants"("owner_id");
CREATE UNIQUE INDEX "restaurant_members_restaurant_id_user_id_key" ON "restaurant_members"("restaurant_id", "user_id");
CREATE INDEX "restaurant_members_restaurant_id_status_idx" ON "restaurant_members"("restaurant_id", "status");
CREATE INDEX "restaurant_members_user_id_status_idx" ON "restaurant_members"("user_id", "status");

ALTER TABLE "restaurants"
  ADD CONSTRAINT "restaurants_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "restaurant_members"
  ADD CONSTRAINT "restaurant_members_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "restaurant_members"
  ADD CONSTRAINT "restaurant_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
