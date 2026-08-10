import { cfg } from "@/config";
import { post, type OperationId, type UUID } from "@/apis/http";

export interface CreateMealPlanRequest {
  operationId: OperationId;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeIds: UUID[];
  note?: string | null;
}

interface MealPlanSummary {
  id: UUID;
}

export const mealApi = {
  createPlan(body: CreateMealPlanRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans`, payload, { idempotencyKey: operationId });
  }
};
