import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "./http";
import type { MealSlot } from "@/utils/meal-slot";

export type MealPollStatus = "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
export type MealPollCandidateStatus = "ACTIVE" | "PENDING" | "REJECTED";
export type ActivityState = "PENDING" | "DONE" | "EXPIRED";
export type DiningGroupActivityKind =
  | "POLL_OPENED"
  | "POLL_VOTED"
  | "POLL_SUGGESTED"
  | "POLL_NOTED"
  | "MENU_CONFIRMED"
  | "COOK_CLAIMED"
  | "BRING_UPDATED"
  | "MEAL_COMPLETED"
  | "MEMORY_CREATED"
  | "MEMBER_JOINED"
  | "INVITE_PENDING";

export interface MealPollSummary {
  id: UUID;
  diningGroupId: UUID;
  title: string;
  planDate: string;
  mealSlot: MealSlot;
  status: MealPollStatus;
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateCount: number;
  responseCount: number;
  confirmedPlanItemId: UUID | null;
  confirmedDiningEventId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
}

export interface MealPollCandidateSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID | null;
  title: string;
  coverUrl: string | null;
  status: MealPollCandidateStatus;
  sourceType: "RECIPE" | "SUGGESTION";
  suggestedByUid: number | null;
  voteCount: number;
}

export interface MealPollResponseSummary {
  id: UUID;
  userUid: number;
  selectedCandidateIds: UUID[];
  suggestionCandidateId: UUID | null;
  note: string | null;
  respondedAt: IsoDateTime;
}

export interface MealPollDetail extends MealPollSummary {
  candidates: MealPollCandidateSummary[];
  responses: MealPollResponseSummary[];
}

export interface DiningGroupActivitySummary {
  id: UUID;
  diningGroupId: UUID;
  kind: DiningGroupActivityKind;
  state: ActivityState;
  actorUid: number | null;
  actorName: string | null;
  title: string;
  detail: string | null;
  pollId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface MealPollListQuery {
  diningGroupId: UUID;
  status?: MealPollStatus;
  planDate?: string;
  mealSlot?: MealSlot;
  limit?: number;
}

export interface DiningGroupActivitiesQuery {
  diningGroupId: UUID;
  limit?: number;
}

export interface CreateMealPollRequest {
  operationId: OperationId;
  diningGroupId: UUID;
  planDate: string;
  mealSlot: MealSlot;
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateRecipeVersionIds: UUID[];
}

export interface VoteMealPollRequest {
  operationId: OperationId;
  expectedVersion: number;
  selectedCandidateIds: UUID[];
  suggestionTitle: string | null;
  note: string | null;
}

export interface ConfirmMealPollRequest {
  operationId: OperationId;
  expectedVersion: number;
  finalRecipeVersionIds: UUID[];
  scheduledAt: IsoDateTime | null;
  location: string | null;
}

export const pollApi = {
  list(query: MealPollListQuery) {
    return get<MealPollSummary[]>(`${cfg.domain}/api/meal-polls`, { ...query });
  },
  getDetail(pollId: UUID) {
    return get<MealPollDetail>(`${cfg.domain}/api/meal-polls/${encodeURIComponent(String(pollId))}`);
  },
  create(body: CreateMealPollRequest) {
    const { operationId, ...payload } = body;
    return post<MealPollDetail>(`${cfg.domain}/api/meal-polls`, payload, { idempotencyKey: operationId });
  },
  vote(pollId: UUID, body: VoteMealPollRequest) {
    const { operationId, ...payload } = body;
    return post<MealPollDetail>(`${cfg.domain}/api/meal-polls/${encodeURIComponent(String(pollId))}/vote`, payload, {
      idempotencyKey: operationId
    });
  },
  confirm(pollId: UUID, body: ConfirmMealPollRequest) {
    const { operationId, ...payload } = body;
    return post<MealPollDetail>(`${cfg.domain}/api/meal-polls/${encodeURIComponent(String(pollId))}/confirm`, payload, {
      idempotencyKey: operationId
    });
  },
  listActivities(query: DiningGroupActivitiesQuery) {
    return get<DiningGroupActivitySummary[]>(`${cfg.domain}/api/dining-group-activities`, { ...query });
  }
};
