import { cfg } from "@/config";
import { get, post, type IsoDateTime, type PageResult, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot } from "@/apis/recipe";

export interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipeId: UUID | null;
  bringRecipeTitle: string | null;
}

export interface DiningEventSummary {
  id: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED";
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  createdAt: IsoDateTime;
}

export interface MealPlanQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface CreateMealPlanRequest {
  operationId: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeId: UUID;
  note?: string | null;
}

export interface CreateDiningEventRequest {
  operationId: UUID;
  scheduledAt: string;
  location?: string | null;
}

export const mealApi = {
  listPlans(query: MealPlanQuery) {
    return get<PageResult<MealPlanSummary>>(`${cfg.domain}/api/meal-plans`, { ...query });
  },
  createPlan(body: CreateMealPlanRequest) {
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans`, body);
  },
  createDiningEvent(planItemId: UUID, body: CreateDiningEventRequest) {
    return post<DiningEventSummary>(`${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/dining-event`, body);
  },
  getDiningEvent(eventId: UUID) {
    return get<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}`);
  },
  inviteDiningGroup(eventId: UUID, diningGroupId: UUID, operationId: UUID) {
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/invite-group`, {
      diningGroupId,
      operationId
    });
  },
  respondToDiningEvent(eventId: UUID, operationId: UUID, status: "ACCEPTED" | "DECLINED") {
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/respond`, {
      operationId,
      status
    });
  },
  chooseBringRecipe(eventId: UUID, recipeId: UUID, operationId: UUID) {
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/bring`, {
      recipeId,
      operationId
    });
  }
};
