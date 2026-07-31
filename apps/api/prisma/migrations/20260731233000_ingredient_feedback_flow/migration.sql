CREATE TYPE "IngredientFeedbackStatus" AS ENUM ('PENDING', 'REJECTED', 'ADOPTED');

CREATE TABLE "ingredient_feedbacks" (
  "id" SERIAL NOT NULL,
  "ingredient_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "status" "IngredientFeedbackStatus" NOT NULL DEFAULT 'PENDING',
  "ingredient_version" INTEGER NOT NULL,
  "ingredient_name" VARCHAR(64) NOT NULL,
  "category_id" INTEGER NOT NULL,
  "category_name" VARCHAR(20) NOT NULL,
  "suggested_name" VARCHAR(64) NOT NULL,
  "suggested_category_id" INTEGER NOT NULL,
  "suggested_category_name" VARCHAR(20) NOT NULL,
  "note" VARCHAR(255),
  "review_note" VARCHAR(255),
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ingredient_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_feedbacks_user_id_created_at_idx"
ON "ingredient_feedbacks"("user_id", "created_at");

CREATE INDEX "ingredient_feedbacks_ingredient_id_created_at_idx"
ON "ingredient_feedbacks"("ingredient_id", "created_at");

CREATE INDEX "ingredient_feedbacks_status_created_at_idx"
ON "ingredient_feedbacks"("status", "created_at");

CREATE UNIQUE INDEX "ingredient_feedbacks_pending_key"
ON "ingredient_feedbacks"("user_id", "ingredient_id")
WHERE "status" = 'PENDING';

ALTER TABLE "ingredient_feedbacks"
ADD CONSTRAINT "ingredient_feedbacks_ingredient_id_fkey"
FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ingredient_feedbacks"
ADD CONSTRAINT "ingredient_feedbacks_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ingredient_feedbacks"
ADD CONSTRAINT "ingredient_feedbacks_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "ingredient_categories"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ingredient_feedbacks"
ADD CONSTRAINT "ingredient_feedbacks_suggested_category_id_fkey"
FOREIGN KEY ("suggested_category_id") REFERENCES "ingredient_categories"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
