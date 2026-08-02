import { requestData, uploadForm, type IsoDateTime, type OperationId, type PageQuery, type PageResult, type UUID } from "./http";

export type MedalAwardRule =
  | "MEAL_COMPLETION"
  | "DINING_EVENT_COMPLETION"
  | "GROUP_MEAL_COMPLETION"
  | "FULL_LOOP_COMPLETION"
  | "RECOMMENDATION_ADOPTED_TOTAL";

export type MedalCategory =
  | "MEAL_CHECKIN"
  | "DINING_COLLABORATION"
  | "RECOMMENDATION_CONTRIBUTION"
  | "HOLIDAY_LIMITED";

export type MedalTemplateStatus = "DRAFT" | "LISTED" | "UNLISTED" | "ARCHIVED";
export type MedalImageType = "earned" | "locked";

export interface AdminMedalTemplateSummary {
  id: UUID;
  code: string;
  awardRule: MedalAwardRule;
  category: MedalCategory;
  categoryName: string;
  name: string;
  description: string;
  condition: string;
  iconKey: string;
  imageUrl: string | null;
  earnedImageUrl: string | null;
  lockedImageUrl: string | null;
  status: MedalTemplateStatus;
  targetCount: number;
  sortOrder: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMedalTemplateQuery extends PageQuery {
  keyword?: string;
  status?: MedalTemplateStatus;
  category?: MedalCategory;
}

export interface CreateAdminMedalTemplatePayload {
  operationId: OperationId;
  awardRule: MedalAwardRule;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  status?: "DRAFT" | "LISTED" | "UNLISTED";
  targetCount?: number;
  sortOrder?: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
}

export interface UpdateAdminMedalTemplatePayload {
  operationId: OperationId;
  expectedVersion: number;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  targetCount?: number;
  sortOrder?: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
}

export interface SetAdminMedalTemplateStatusPayload {
  operationId: OperationId;
  expectedVersion: number;
  status: MedalTemplateStatus;
}

export interface UpdateAdminMedalTemplateImagePayload {
  operationId: OperationId;
  expectedVersion: number;
}

export const medalApi = {
  list(query: AdminMedalTemplateQuery) {
    return requestData<PageResult<AdminMedalTemplateSummary>>("/admin/medal-templates", {
      query: { ...query }
    });
  },
  create(body: CreateAdminMedalTemplatePayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminMedalTemplateSummary>("/admin/medal-templates", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  update(templateId: UUID, body: UpdateAdminMedalTemplatePayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminMedalTemplateSummary>(`/admin/medal-templates/${encodeURIComponent(String(templateId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  setStatus(templateId: UUID, body: SetAdminMedalTemplateStatusPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminMedalTemplateSummary>(`/admin/medal-templates/${encodeURIComponent(String(templateId))}/status`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  uploadImage(templateId: UUID, imageType: MedalImageType, file: File, body: UpdateAdminMedalTemplateImagePayload) {
    const formData = new FormData();
    formData.append("expectedVersion", String(body.expectedVersion));
    formData.append("file", file);
    return uploadForm<AdminMedalTemplateSummary>(
      `/admin/medal-templates/${encodeURIComponent(String(templateId))}/image/${encodeURIComponent(imageType)}`,
      formData,
      {
        idempotencyKey: body.operationId
      }
    );
  },
  clearImage(templateId: UUID, imageType: MedalImageType, body: UpdateAdminMedalTemplateImagePayload) {
    return requestData<AdminMedalTemplateSummary>(
      `/admin/medal-templates/${encodeURIComponent(String(templateId))}/image/${encodeURIComponent(imageType)}`,
      {
        method: "DELETE",
        body: { expectedVersion: body.expectedVersion },
        idempotencyKey: body.operationId
      }
    );
  }
};
