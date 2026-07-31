import { cfg } from "@/config";
import { get, post, type IsoDateTime, type PageResult, type OperationId, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot } from "@/apis/recipe";

export interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  status: "PLANNED" | "COMPLETED";
  completedAt: IsoDateTime | null;
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
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface MealPlanQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface CreateMealPlanRequest {
  operationId: OperationId;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeId: UUID;
  note?: string | null;
}

export interface CreateDiningEventRequest {
  operationId: OperationId;
  scheduledAt: string;
  location?: string | null;
}

export const mealApi = {
  listPlans(query: MealPlanQuery) {
    return get<PageResult<MealPlanSummary>>(`${cfg.domain}/api/meal-plans`, { ...query });
  },
  createPlan(body: CreateMealPlanRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans`, payload, { idempotencyKey: operationId });
  },
  completePlan(planItemId: UUID, operationId: OperationId) {
    return post<MealPlanSummary>(
      `${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/complete`,
      undefined,
      { idempotencyKey: operationId }
    );
  },
  createDiningEvent(planItemId: UUID, body: CreateDiningEventRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(`${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/dining-event`, payload, {
      idempotencyKey: operationId
    });
  },
  getDiningEvent(eventId: UUID) {
    return get<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}`);
  },
  inviteDiningGroup(eventId: UUID, diningGroupId: UUID, operationId: OperationId) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/invite-group`,
      { diningGroupId },
      { idempotencyKey: operationId }
    );
  },
  respondToDiningEvent(eventId: UUID, operationId: OperationId, status: "ACCEPTED" | "DECLINED") {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/respond`,
      { status },
      { idempotencyKey: operationId }
    );
  },
  chooseBringRecipe(eventId: UUID, recipeId: UUID, operationId: OperationId) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/bring`,
      { recipeId },
      { idempotencyKey: operationId }
    );
  },
  completeDiningEvent(eventId: UUID, operationId: OperationId) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/complete`,
      undefined,
      { idempotencyKey: operationId }
    );
  }
};
