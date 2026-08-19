import { cfg } from "@/config";
import { get, post, uploadFile, type IsoDateTime, type OperationId, type PageResult, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot, RecipeDuration } from "@/apis/recipe";
import type { MealSlot } from "@/utils/meal-slot";
import { addDays, formatDateOnly } from "../utils/date";

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
  menuLocked: boolean;
  status: "PLANNED" | "COMPLETED";
  version: number;
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface MealPlanCookAssistantTask {
  title: string;
  detail: string;
  dishTitles: string[];
}

export interface MealPlanCookAssistantTimelineStep extends MealPlanCookAssistantTask {
  order: number;
  parallelKey: string | null;
}

export interface MealPlanCookAssistantSummary {
  dishCount: number;
  prepTaskCount: number;
  timelineStepCount: number;
  totalDurationText: string | null;
  suggestedStartTime: string | null;
  notes: string[];
}

export interface MealPlanCookAssistant {
  planItemId: UUID;
  hasSnapshot: boolean;
  isStale: boolean;
  generatedAt: IsoDateTime | null;
  summary: MealPlanCookAssistantSummary;
  prepTasks: MealPlanCookAssistantTask[];
  cookTimeline: MealPlanCookAssistantTimelineStep[];
  serveTasks: MealPlanCookAssistantTask[];
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
  note: string | null;
  coverImageUrl: string | null;
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
  hasActiveShareLink: boolean;
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
}

export interface DiningEventShareLinkResponse {
  shareTokenPath: string;
  expiresAt: IsoDateTime | null;
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
  mealSlot: MealSlot;
  expectedVersion?: number | null;
  title?: string | null;
  menuItems: Array<{
    slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
    sortOrder: number;
    recipeId: UUID;
    recipeVersionId: UUID;
    purchaseState: "READY" | "PENDING";
  }>;
  note?: string | null;
}

export interface UpdateMealPlanTitleRequest {
  operationId: OperationId;
  expectedVersion: number;
  title?: string | null;
}

export interface ConfirmMealPlanMenuRequest {
  operationId: OperationId;
  expectedVersion: number;
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

export interface CreateDiningEventRequest {
  operationId: OperationId;
  scheduledAt: string;
  location?: string | null;
}

export interface UpdateDiningEventScheduleRequest {
  operationId: OperationId;
  expectedVersion: number;
  scheduledAt: string;
  location?: string | null;
}

export interface UpdateDiningEventNoteRequest {
  operationId: OperationId;
  expectedVersion: number;
  note: string | null;
}

export interface CreateDirectDiningEventRequest {
  operationId: OperationId;
  planDate: string;
  mealSlot: MealSlot;
  scheduledAt: string;
  location?: string | null;
}

export interface UpdateDiningEventCoverRequest {
  operationId: OperationId;
  expectedVersion: number;
  filePath: string;
}

export interface ManageDiningEventParticipantRequest {
  operationId: OperationId;
}

export interface GenerateMealPlanCookAssistantRequest {
  operationId: OperationId;
}

export interface ClaimCookRequest {
  operationId: OperationId;
  expectedVersion: number;
  menuItemId: UUID;
  action: "CLAIM" | "RELEASE";
}

export interface ChooseBringRecipeRequest {
  operationId: OperationId;
  recipeId: UUID;
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
  createPlan(body: CreateMealPlanRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans`, payload, { idempotencyKey: operationId });
  },
  updatePlanTitle(planItemId: UUID, body: UpdateMealPlanTitleRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/title`, payload, {
      idempotencyKey: operationId
    });
  },
  confirmPlanMenu(planItemId: UUID, body: ConfirmMealPlanMenuRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/confirm-menu`, payload, {
      idempotencyKey: operationId
    });
  },
  addPlanItem(body: AddMealPlanItemRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans/items`, payload, { idempotencyKey: operationId });
  },
  getCookAssistant(planItemId: UUID) {
    return get<MealPlanCookAssistant>(`${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/cook-assistant`);
  },
  generateCookAssistant(planItemId: UUID, body: GenerateMealPlanCookAssistantRequest) {
    const { operationId, ...payload } = body;
    return post<MealPlanCookAssistant>(
      `${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/cook-assistant`,
      payload,
      { idempotencyKey: operationId }
    );
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
  createDirectDiningEvent(body: CreateDirectDiningEventRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events`, payload, {
      idempotencyKey: operationId
    });
  },
  getDiningEvent(eventId: UUID) {
    return get<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}`);
  },
  createDiningEventShareLink(eventId: UUID, operationId: OperationId) {
    return post<DiningEventShareLinkResponse>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/share-link`,
      undefined,
      { idempotencyKey: operationId }
    );
  },
  disableDiningEventShareLink(eventId: UUID, operationId: OperationId) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/share-link/disable`,
      undefined,
      { idempotencyKey: operationId }
    );
  },
  revokeDiningEventParticipantInvite(eventId: UUID, participantId: UUID, body: ManageDiningEventParticipantRequest) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/revoke`,
      undefined,
      { idempotencyKey: body.operationId }
    );
  },
  reinviteDiningEventParticipant(eventId: UUID, participantId: UUID, body: ManageDiningEventParticipantRequest) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/reinvite`,
      undefined,
      { idempotencyKey: body.operationId }
    );
  },
  updateDiningEventSchedule(eventId: UUID, body: UpdateDiningEventScheduleRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/schedule`, payload, {
      idempotencyKey: operationId
    });
  },
  updateDiningEventNote(eventId: UUID, body: UpdateDiningEventNoteRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/note`, payload, {
      idempotencyKey: operationId
    });
  },
  async uploadDiningEventCover(eventId: UUID, body: UpdateDiningEventCoverRequest) {
    const result = await uploadFile({
      url: `${cfg.domain}/api/dining-events/${encodeURIComponent(String(eventId))}/cover`,
      filePath: body.filePath,
      name: "file",
      headers: {
        "Idempotency-Key": body.operationId
      },
      formData: {
        expectedVersion: body.expectedVersion
      }
    });
    if (typeof result.body !== "object" || result.body === null || !("code" in result.body) || !("message" in result.body) || !("data" in result.body)) {
      throw new Error("饭局封面上传响应格式不正确");
    }
    const payload = result.body as { code: number; message?: string; data: unknown };
    if (result.status < 200 || result.status >= 300 || payload.code !== 0) {
      throw new Error(payload.message || "饭局封面上传失败");
    }
    return payload.data as DiningEventSummary;
  },
  completeDiningEvent(eventId: UUID, operationId: OperationId) {
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/complete`,
      undefined,
      { idempotencyKey: operationId }
    );
  },
  claimCook(eventId: UUID, body: ClaimCookRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/cook`,
      payload,
      { idempotencyKey: operationId }
    );
  },
  chooseBringRecipe(eventId: UUID, body: ChooseBringRecipeRequest) {
    const { operationId, ...payload } = body;
    return post<DiningEventSummary>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/bring`,
      payload,
      { idempotencyKey: operationId }
    );
  }
};

export function listWeekPlans(weekStart: Date) {
  const from = formatDateOnly(weekStart);
  const to = formatDateOnly(addDays(weekStart, 6));
  return mealApi.listPlans({ from, to });
}
