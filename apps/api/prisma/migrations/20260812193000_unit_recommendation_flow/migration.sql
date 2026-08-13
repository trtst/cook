CREATE TYPE "UnitRecommendationStatus" AS ENUM ('PENDING', 'REJECTED', 'ADOPTED', 'MERGED');

CREATE TABLE "unit_recommendations" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "unit_name" VARCHAR(16) NOT NULL,
  "unit_type" "UnitType" NOT NULL,
  "search_key" VARCHAR(32) NOT NULL,
  "status" "UnitRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "review_note" VARCHAR(255),
  "review_advice" VARCHAR(255),
  "target_unit_id" INTEGER,
  "reviewed_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "unit_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "unit_recommendations_user_id_created_at_idx"
ON "unit_recommendations"("user_id", "created_at");

CREATE INDEX "unit_recommendations_status_created_at_idx"
ON "unit_recommendations"("status", "created_at");

CREATE INDEX "unit_recommendations_search_key_idx"
ON "unit_recommendations"("search_key");

CREATE UNIQUE INDEX "unit_recommendations_pending_key"
ON "unit_recommendations"("user_id", "search_key")
WHERE "status" = 'PENDING';

ALTER TABLE "unit_recommendations"
ADD CONSTRAINT "unit_recommendations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "unit_recommendations"
ADD CONSTRAINT "unit_recommendations_target_unit_id_fkey"
FOREIGN KEY ("target_unit_id") REFERENCES "units"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
