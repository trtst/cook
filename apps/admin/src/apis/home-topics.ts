import { requestData, uploadForm, type OperationId, type UUID } from "./http";

export type HomeTopicType =
  | "WEEKEND_GATHERING"
  | "QUICK_AFTER_WORK"
  | "HOME_STYLE"
  | "ONE_PERSON"
  | "BREAKFAST"
  | "LIGHT_DINNER";
export type HomeTopicStatus = "DRAFT" | "PUBLISHED" | "UNLISTED";
export type HomeTopicWeekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export const homeTopicWeekdays: Array<{ value: HomeTopicWeekday; label: string }> = [
  { value: "MONDAY", label: "周一" }, { value: "TUESDAY", label: "周二" }, { value: "WEDNESDAY", label: "周三" },
  { value: "THURSDAY", label: "周四" }, { value: "FRIDAY", label: "周五" }, { value: "SATURDAY", label: "周六" }, { value: "SUNDAY", label: "周日" }
];

export interface HomeTopicTypeOption {
  label: string;
  value: HomeTopicType;
}

export interface HomeTopicRecipeItem {
  id: UUID;
  weekday?: HomeTopicWeekday;
  publiclyAvailable?: boolean;
  sort: number;
  title: string;
  coverImageUrl: string | null;
  recommendNote: string | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
  difficultyText: string | null;
  durationText: string | null;
  category: {
    id: UUID;
    name: string;
    iconKey: string | null;
  };
  collectCount: number;
  updatedAt: string;
}

export interface AdminHomeTopicItem {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  status: HomeTopicStatus;
  issueNo: number;
  periodStartDate: string;
  periodEndDate: string;
  scheduledPublishAt: string | null;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: string | null;
  updatedAt: string;
  items: HomeTopicRecipeItem[];
  version: number;
}

export interface AdminHomeTopicsResponse {
  topics: AdminHomeTopicItem[];
  recTypes: HomeTopicTypeOption[];
}

export interface HomeTopicRecipeSearchResponse {
  items: HomeTopicRecipeItem[];
}

export interface HomeTopicPickInput {
  recipeId: UUID;
  weekday: HomeTopicWeekday;
  sortOrder: number;
  recommendNote: string | null;
}

export interface CreateHomeTopicRequest {
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  issueNo: number;
  description: string;
  items: HomeTopicPickInput[];
}

export interface UpdateHomeTopicRequest extends CreateHomeTopicRequest {
  expectedVersion: number;
}

export interface SetHomeTopicStatusRequest {
  status: HomeTopicStatus;
  expectedVersion: number;
}

export interface SetHomeTopicScheduleRequest {
  scheduledPublishAt: string | null;
  expectedVersion: number;
}

export interface HomeTopicTodosResponse {
  items: Array<{
    itemId: UUID; topicId: UUID; topicTitle: string; issueNo: number; periodStartDate: string;
    topicVersion: number; weekday: HomeTopicWeekday; recipeId: UUID; recipeName: string; sourceVersionId: UUID;
  }>;
  page: number; pageSize: number; total: number; hasNext: boolean;
}

export interface DeleteHomeTopicRequest {
  expectedVersion: number;
}

export const homeTopicsApi = {
  getTopics() {
    return requestData<AdminHomeTopicsResponse>("/admin/home-topics");
  },
  searchRecipes(keyword?: string) {
    return requestData<HomeTopicRecipeSearchResponse>("/admin/home-topics/recipes", {
      query: keyword ? { keyword } : undefined
    });
  },
  createTopic(body: CreateHomeTopicRequest, operationId: OperationId) {
    return requestData<AdminHomeTopicsResponse>("/admin/home-topics", {
      method: "POST",
      body,
      idempotencyKey: operationId
    });
  },
  updateTopic(topicId: UUID, body: UpdateHomeTopicRequest, operationId: OperationId) {
    return requestData<AdminHomeTopicsResponse>(`/admin/home-topics/${encodeURIComponent(String(topicId))}`, {
      method: "PUT",
      body,
      idempotencyKey: operationId
    });
  },
  setTopicStatus(topicId: UUID, body: SetHomeTopicStatusRequest, operationId: OperationId) {
    return requestData<AdminHomeTopicItem>(`/admin/home-topics/${encodeURIComponent(String(topicId))}/status`, {
      method: "POST",
      body,
      idempotencyKey: operationId
    });
  },
  setTopicSchedule(topicId: UUID, body: SetHomeTopicScheduleRequest, operationId: OperationId) {
    return requestData<AdminHomeTopicItem>(`/admin/home-topics/${encodeURIComponent(String(topicId))}/schedule`, {
      method: "POST", body, idempotencyKey: operationId
    });
  },
  getTodos() {
    return requestData<HomeTopicTodosResponse>("/admin/home-topics/todos", { query: { page: 1, pageSize: 100 } });
  },
  replaceItem(itemId: UUID, replacementRecipeId: UUID, expectedVersion: number, operationId: OperationId) {
    return requestData<AdminHomeTopicItem>(`/admin/home-topics/items/${encodeURIComponent(String(itemId))}/replace`, {
      method: "POST", body: { replacementRecipeId, expectedVersion }, idempotencyKey: operationId
    });
  },
  dismissTodo(itemId: UUID, expectedVersion: number, operationId: OperationId) {
    return requestData<AdminHomeTopicItem>(`/admin/home-topics/items/${encodeURIComponent(String(itemId))}/dismiss`, {
      method: "POST", body: { expectedVersion }, idempotencyKey: operationId
    });
  },
  deleteTopic(topicId: UUID, body: DeleteHomeTopicRequest, operationId: OperationId) {
    return requestData<AdminHomeTopicsResponse>(`/admin/home-topics/${encodeURIComponent(String(topicId))}`, {
      method: "DELETE",
      body,
      idempotencyKey: operationId
    });
  },
  uploadTopicImage(topicId: UUID, file: File, operationId: OperationId, expectedVersion: number) {
    const formData = new FormData();
    formData.append("expectedVersion", String(expectedVersion));
    formData.append("file", file);
    return uploadForm<AdminHomeTopicItem>(`/admin/home-topics/${encodeURIComponent(String(topicId))}/image`, formData, {
      idempotencyKey: operationId
    });
  },
  clearTopicImage(topicId: UUID, operationId: OperationId, expectedVersion: number) {
    return requestData<AdminHomeTopicItem>(`/admin/home-topics/${encodeURIComponent(String(topicId))}/image`, {
      method: "DELETE",
      body: { expectedVersion },
      idempotencyKey: operationId
    });
  }
};
