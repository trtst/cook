CREATE TYPE "MealPollStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'CONFIRMED',
    'COMPLETED'
);

CREATE TYPE "MealPollCandidateSourceType" AS ENUM (
    'RECIPE',
    'SUGGESTION'
);

CREATE TYPE "MealPollCandidateStatus" AS ENUM (
    'ACTIVE',
    'PENDING',
    'REJECTED'
);

CREATE TYPE "ActivityState" AS ENUM (
    'PENDING',
    'DONE',
    'EXPIRED'
);

CREATE TYPE "DiningGroupActivityKind" AS ENUM (
    'POLL_OPENED',
    'POLL_VOTED',
    'POLL_SUGGESTED',
    'POLL_NOTED',
    'MENU_CONFIRMED',
    'COOK_CLAIMED',
    'BRING_UPDATED',
    'MEAL_COMPLETED',
    'MEMORY_CREATED',
    'MEMBER_JOINED',
    'INVITE_PENDING'
);

CREATE TABLE "meal_polls" (
    "id" SERIAL NOT NULL,
    "dining_group_id" INTEGER NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "confirmed_plan_item_id" INTEGER,
    "confirmed_dining_event_id" INTEGER,
    "plan_date" DATE NOT NULL,
    "meal_slot" "MealSlot" NOT NULL,
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "choice_limit" INTEGER NOT NULL,
    "note" VARCHAR(255),
    "status" "MealPollStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_polls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meal_polls_choice_limit_check" CHECK ("choice_limit" BETWEEN 1 AND 3)
);

CREATE TABLE "meal_poll_candidates" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "recipe_version_id" INTEGER,
    "title" VARCHAR(120) NOT NULL,
    "source_type" "MealPollCandidateSourceType" NOT NULL,
    "status" "MealPollCandidateStatus" NOT NULL DEFAULT 'ACTIVE',
    "suggested_by_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_poll_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meal_poll_responses" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "note" VARCHAR(255),
    "responded_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_poll_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meal_poll_response_items" (
    "id" SERIAL NOT NULL,
    "response_id" INTEGER NOT NULL,
    "candidate_id" INTEGER NOT NULL,

    CONSTRAINT "meal_poll_response_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dining_group_activities" (
    "id" SERIAL NOT NULL,
    "dining_group_id" INTEGER NOT NULL,
    "kind" "DiningGroupActivityKind" NOT NULL,
    "state" "ActivityState" NOT NULL DEFAULT 'PENDING',
    "actor_user_id" INTEGER,
    "title" VARCHAR(120) NOT NULL,
    "detail" VARCHAR(255),
    "poll_id" INTEGER,
    "plan_item_id" INTEGER,
    "dining_event_id" INTEGER,
    "dedupe_key" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_group_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dining_event_menu_items" (
    "id" SERIAL NOT NULL,
    "dining_event_id" INTEGER NOT NULL,
    "recipe_version_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "cook_user_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_event_menu_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_event_menu_items_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "meal_polls_dining_group_id_plan_date_meal_slot_key"
ON "meal_polls"("dining_group_id", "plan_date", "meal_slot");

CREATE INDEX "meal_polls_dining_group_id_status_deadline_at_idx"
ON "meal_polls"("dining_group_id", "status", "deadline_at");

CREATE INDEX "meal_polls_dining_group_id_plan_date_meal_slot_idx"
ON "meal_polls"("dining_group_id", "plan_date" DESC, "meal_slot");

CREATE INDEX "meal_polls_created_by_user_id_created_at_idx"
ON "meal_polls"("created_by_user_id", "created_at");

CREATE UNIQUE INDEX "meal_polls_confirmed_plan_item_id_key"
ON "meal_polls"("confirmed_plan_item_id");

CREATE UNIQUE INDEX "meal_polls_confirmed_dining_event_id_key"
ON "meal_polls"("confirmed_dining_event_id");

CREATE INDEX "meal_poll_candidates_poll_id_status_id_idx"
ON "meal_poll_candidates"("poll_id", "status", "id");

CREATE INDEX "meal_poll_candidates_recipe_version_id_idx"
ON "meal_poll_candidates"("recipe_version_id");

CREATE INDEX "meal_poll_candidates_suggested_by_user_id_created_at_idx"
ON "meal_poll_candidates"("suggested_by_user_id", "created_at");

CREATE UNIQUE INDEX "meal_poll_responses_poll_id_user_id_key"
ON "meal_poll_responses"("poll_id", "user_id");

CREATE INDEX "meal_poll_responses_poll_id_responded_at_idx"
ON "meal_poll_responses"("poll_id", "responded_at" DESC);

CREATE INDEX "meal_poll_responses_user_id_responded_at_idx"
ON "meal_poll_responses"("user_id", "responded_at" DESC);

CREATE UNIQUE INDEX "meal_poll_response_items_response_id_candidate_id_key"
ON "meal_poll_response_items"("response_id", "candidate_id");

CREATE INDEX "meal_poll_response_items_candidate_id_idx"
ON "meal_poll_response_items"("candidate_id");

CREATE UNIQUE INDEX "dining_group_activities_dining_group_id_dedupe_key_key"
ON "dining_group_activities"("dining_group_id", "dedupe_key");

CREATE INDEX "dining_group_activities_dining_group_id_created_at_idx"
ON "dining_group_activities"("dining_group_id", "created_at" DESC);

CREATE INDEX "dining_event_menu_items_dining_event_id_sort_order_idx"
ON "dining_event_menu_items"("dining_event_id", "sort_order");

CREATE INDEX "dining_event_menu_items_dining_event_id_cook_user_id_idx"
ON "dining_event_menu_items"("dining_event_id", "cook_user_id");

CREATE INDEX "dining_event_menu_items_cook_user_id_updated_at_idx"
ON "dining_event_menu_items"("cook_user_id", "updated_at");

CREATE UNIQUE INDEX "dining_event_participants_dining_event_id_user_id_key"
ON "dining_event_participants"("dining_event_id", "user_id")
WHERE "user_id" IS NOT NULL;

ALTER TABLE "meal_polls"
ADD CONSTRAINT "meal_polls_dining_group_id_fkey"
FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_polls"
ADD CONSTRAINT "meal_polls_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_polls"
ADD CONSTRAINT "meal_polls_confirmed_plan_item_id_fkey"
FOREIGN KEY ("confirmed_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_polls"
ADD CONSTRAINT "meal_polls_confirmed_dining_event_id_fkey"
FOREIGN KEY ("confirmed_dining_event_id") REFERENCES "dining_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_poll_candidates"
ADD CONSTRAINT "meal_poll_candidates_poll_id_fkey"
FOREIGN KEY ("poll_id") REFERENCES "meal_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_poll_candidates"
ADD CONSTRAINT "meal_poll_candidates_recipe_version_id_fkey"
FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_poll_candidates"
ADD CONSTRAINT "meal_poll_candidates_suggested_by_user_id_fkey"
FOREIGN KEY ("suggested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_poll_responses"
ADD CONSTRAINT "meal_poll_responses_poll_id_fkey"
FOREIGN KEY ("poll_id") REFERENCES "meal_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_poll_responses"
ADD CONSTRAINT "meal_poll_responses_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_poll_response_items"
ADD CONSTRAINT "meal_poll_response_items_response_id_fkey"
FOREIGN KEY ("response_id") REFERENCES "meal_poll_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_poll_response_items"
ADD CONSTRAINT "meal_poll_response_items_candidate_id_fkey"
FOREIGN KEY ("candidate_id") REFERENCES "meal_poll_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_group_activities"
ADD CONSTRAINT "dining_group_activities_dining_group_id_fkey"
FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dining_group_activities"
ADD CONSTRAINT "dining_group_activities_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dining_group_activities"
ADD CONSTRAINT "dining_group_activities_poll_id_fkey"
FOREIGN KEY ("poll_id") REFERENCES "meal_polls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dining_group_activities"
ADD CONSTRAINT "dining_group_activities_plan_item_id_fkey"
FOREIGN KEY ("plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dining_group_activities"
ADD CONSTRAINT "dining_group_activities_dining_event_id_fkey"
FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dining_event_menu_items"
ADD CONSTRAINT "dining_event_menu_items_dining_event_id_fkey"
FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_menu_items"
ADD CONSTRAINT "dining_event_menu_items_recipe_version_id_fkey"
FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dining_event_menu_items"
ADD CONSTRAINT "dining_event_menu_items_cook_user_id_fkey"
FOREIGN KEY ("cook_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
