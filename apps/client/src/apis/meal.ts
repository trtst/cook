import { cfg } from "@/config";
import { get, post, type IsoDateTime, type PageResult, type OperationId, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot } from "@/apis/recipe";

export interface MealPlanMenuItemSummary {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  sortOrder: number;
}

export interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  title: string;
  menuItems: MealPlanMenuItemSummary[];
  status: "PLANNED" | "COMPLETED";
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  displayName: string | null;
  avatarUrl: string | null;
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
  organizerUid: number | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  menuItems: Array<{
    id: UUID;
    recipeId: UUID | null;
    recipeVersionId: UUID;
    title: string;
    cookUserUid: number | null;
    cookName: string | null;
    version: number;
  }>;
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  version: number;
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
  recipeIds: UUID[];
  note?: string | null;
}

export interface CreateDiningEventRequest {
  operationId: OperationId;
  scheduledAt: string;
  location?: string | null;
}

export interface ClaimCookRequest {
  operationId: OperationId;
  expectedVersion: number;
  menuItemId: UUID;
  action: "CLAIM" | "RELEASE";
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
  claimCook(eventId: UUID, body: ClaimCookRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/cook`, payload, {
      idempotencyKey: operationId
    });
  },
  completeDiningEvent(eventId: UUID, operationId: OperationId) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/complete`,
      undefined,
      { idempotencyKey: operationId }
    );
  }
};
