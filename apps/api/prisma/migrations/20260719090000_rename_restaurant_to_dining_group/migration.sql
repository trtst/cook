DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RestaurantStatus')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiningGroupStatus') THEN
    ALTER TYPE "RestaurantStatus" RENAME TO "DiningGroupStatus";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RestaurantRole')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiningGroupRole') THEN
    ALTER TYPE "RestaurantRole" RENAME TO "DiningGroupRole";
  END IF;

  IF to_regclass('public.restaurants') IS NOT NULL
     AND to_regclass('public.dining_groups') IS NULL THEN
    ALTER TABLE "restaurants" RENAME TO "dining_groups";
  END IF;

  IF to_regclass('public.restaurant_members') IS NOT NULL
     AND to_regclass('public.dining_group_members') IS NULL THEN
    ALTER TABLE "restaurant_members" RENAME TO "dining_group_members";
  END IF;

  IF to_regclass('public.dining_group_members') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'dining_group_members'
         AND column_name = 'restaurant_id'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'dining_group_members'
         AND column_name = 'dining_group_id'
     ) THEN
    ALTER TABLE "dining_group_members" RENAME COLUMN "restaurant_id" TO "dining_group_id";
  END IF;
END $$;

ALTER TABLE IF EXISTS "dining_groups"
  RENAME CONSTRAINT "restaurants_pkey" TO "dining_groups_pkey";

ALTER TABLE IF EXISTS "dining_group_members"
  RENAME CONSTRAINT "restaurant_members_pkey" TO "dining_group_members_pkey";

ALTER TABLE IF EXISTS "dining_groups"
  RENAME CONSTRAINT "restaurants_owner_id_fkey" TO "dining_groups_owner_id_fkey";

ALTER TABLE IF EXISTS "dining_group_members"
  RENAME CONSTRAINT "restaurant_members_restaurant_id_fkey" TO "dining_group_members_dining_group_id_fkey";

ALTER TABLE IF EXISTS "dining_group_members"
  RENAME CONSTRAINT "restaurant_members_user_id_fkey" TO "dining_group_members_user_id_fkey";

ALTER INDEX IF EXISTS "restaurants_status_created_at_idx"
  RENAME TO "dining_groups_status_created_at_idx";

ALTER INDEX IF EXISTS "restaurants_name_idx"
  RENAME TO "dining_groups_name_idx";

ALTER INDEX IF EXISTS "restaurants_owner_id_idx"
  RENAME TO "dining_groups_owner_id_idx";

ALTER INDEX IF EXISTS "restaurant_members_restaurant_id_user_id_key"
  RENAME TO "dining_group_members_dining_group_id_user_id_key";

ALTER INDEX IF EXISTS "restaurant_members_restaurant_id_status_idx"
  RENAME TO "dining_group_members_dining_group_id_status_idx";

ALTER INDEX IF EXISTS "restaurant_members_user_id_status_idx"
  RENAME TO "dining_group_members_user_id_status_idx";
