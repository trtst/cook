import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type PageResult, type UUID } from "@/apis/http";
import type { RecipeDuration } from "@/apis/recipe";
import type { MealSlot } from "@/utils/meal-slot";

export interface MealPlanMenuItemSummary {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  servings: number | null;
  duration: RecipeDuration | null;
  durationText: string | null;
  slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
  purchaseState: "READY" | "PENDING";
  sortOrder: number;
}

export interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: MealSlot;
  title: string;
  menuItems: MealPlanMenuItemSummary[];
  status: "PLANNED" | "COMPLETED";
  version: number;
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface MealPlanQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface AddMealPlanItemRequest {
  operationId: OperationId;
  planDate: string;
  mealSlot: MealSlot;
  recipeId: UUID;
  recipeVersionId: UUID;
  slotType?: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
  purchaseState?: "READY" | "PENDING";
}

export const mealApi = {
  listPlans(query: MealPlanQuery) {
    return get<PageResult<MealPlanSummary>>(`${cfg.domain}/api/meal-plans`, { ...query });
  },
  async listAllPlans(query: MealPlanQuery) {
    const items: MealPlanSummary[] = [];
    let page = 1;
    do {
      const result = await this.listPlans({ ...query, page, pageSize: 100 });
      items.push(...result.items);
      if (!result.hasNext) return items;
      page += 1;
    } while (true);
  },
  addPlanItem(body: AddMealPlanItemRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans/items`, payload, { idempotencyKey: operationId });
  }
};
