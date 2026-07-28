import { get, type PageResult, type UUID } from "@/apis/http";
import { cfg } from "@/config";

export interface PantryMealPlanSummary {
  id: UUID;
  planDate: string;
  title: string;
  diningEventId: UUID | null;
}

export interface PantryMealPlanQuery {
  page?: number;
  pageSize?: number;
}

export const pantryMealApi = {
  listPlans(query: PantryMealPlanQuery) {
    return get<PageResult<PantryMealPlanSummary>>(`${cfg.domain}/api/meal-plans`, { ...query });
  }
};
