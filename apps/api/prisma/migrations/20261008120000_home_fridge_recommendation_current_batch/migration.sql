ALTER TABLE "home_fridge_recommendation_caches"
ADD COLUMN "current_candidates" JSONB NOT NULL DEFAULT '[]';

-- Cached recommendation batches are rebuildable; discard batches produced by the old read-advances contract.
DELETE FROM "home_fridge_recommendation_caches";
