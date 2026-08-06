import { requestData, uploadForm, type OperationId, type UUID } from "./http";

export type HomeTopicType =
  | "WEEKEND_GATHERING"
  | "QUICK_AFTER_WORK"
  | "HOME_STYLE"
  | "ONE_PERSON"
  | "BREAKFAST"
  | "LIGHT_DINNER";
export type HomeTopicStatus = "LISTED" | "UNLISTED";

export interface HomeTopicTypeOption {
  label: string;
  value: HomeTopicType;
}

export interface HomeTopicRecipeItem {
  id: UUID;
  sort: number;
  title: string;
  coverImageUrl: string | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
  category: {
    id: UUID;
    name: string;
    iconKey: string | null;
  };
  likeCount: number;
  collectCount: number;
  updatedAt: string;
}

export interface AdminHomeTopicItem {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  status: HomeTopicStatus;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: string;
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

export interface CreateHomeTopicRequest {
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  issueNo: number;
  description: string;
  recipeIds: UUID[];
}

export interface UpdateHomeTopicRequest extends CreateHomeTopicRequest {
  expectedVersion: number;
}

export interface SetHomeTopicStatusRequest {
  status: HomeTopicStatus;
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
