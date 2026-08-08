import { requestData, uploadForm, type OperationId } from "./http";

export type TableTopicStatus = "LISTED" | "UNLISTED";
export type TableTopicTargetType = "PAGE" | "WEB_VIEW";

export interface AdminTableTopicItem {
  id: number;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  activityAt: string;
  participantCount: number;
  targetType: TableTopicTargetType;
  targetValue: string | null;
  status: TableTopicStatus;
  version: number;
  updatedAt: string;
}

export interface AdminTableTopicsResponse {
  topics: AdminTableTopicItem[];
}

export interface CreateTableTopicRequest {
  title: string;
  summary: string;
  activityAt: string;
  targetType: TableTopicTargetType;
  targetValue: string | null;
}

export interface UpdateTableTopicRequest extends CreateTableTopicRequest {
  expectedVersion: number;
}

export interface SetTableTopicStatusRequest {
  status: TableTopicStatus;
  expectedVersion: number;
}

export const tableTopicsApi = {
  getTopics() {
    return requestData<AdminTableTopicsResponse>("/admin/table-topics");
  },
  createTopic(body: CreateTableTopicRequest, operationId: OperationId) {
    return requestData<AdminTableTopicsResponse>("/admin/table-topics", {
      method: "POST",
      idempotencyKey: operationId,
      body
    });
  },
  updateTopic(topicId: number, body: UpdateTableTopicRequest, operationId: OperationId) {
    return requestData<AdminTableTopicsResponse>(`/admin/table-topics/${encodeURIComponent(String(topicId))}`, {
      method: "PUT",
      idempotencyKey: operationId,
      body
    });
  },
  setTopicStatus(topicId: number, body: SetTableTopicStatusRequest, operationId: OperationId) {
    return requestData<AdminTableTopicItem>(`/admin/table-topics/${encodeURIComponent(String(topicId))}/status`, {
      method: "POST",
      idempotencyKey: operationId,
      body
    });
  },
  uploadTopicImage(topicId: number, file: File, operationId: OperationId, expectedVersion: number) {
    const formData = new FormData();
    formData.append("expectedVersion", String(expectedVersion));
    formData.append("file", file);
    return uploadForm<AdminTableTopicItem>(`/admin/table-topics/${encodeURIComponent(String(topicId))}/image`, formData, {
      idempotencyKey: operationId
    });
  },
  clearTopicImage(topicId: number, operationId: OperationId, expectedVersion: number) {
    return requestData<AdminTableTopicItem>(`/admin/table-topics/${encodeURIComponent(String(topicId))}/image`, {
      method: "DELETE",
      idempotencyKey: operationId,
      body: { expectedVersion }
    });
  }
};
