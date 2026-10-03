ALTER TABLE "cook_assistant_unlocks"
  ADD COLUMN "counts_toward_daily_limit" BOOLEAN NOT NULL DEFAULT true;
