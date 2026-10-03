CREATE INDEX "ingredient_feedbacks_user_id_updated_at_id_idx"
ON "ingredient_feedbacks"("user_id", "updated_at", "id");

CREATE INDEX "recipe_recommendations_user_id_updated_at_id_idx"
ON "recipe_recommendations"("user_id", "updated_at", "id");
