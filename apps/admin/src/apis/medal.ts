import { requestData, uploadForm, type IsoDateTime, type OperationId, type PageQuery, type PageResult, type UUID } from "./http";

export type MedalAwardRule =
  | "MEAL_COMPLETION"
  | "DINING_EVENT_COMPLETION"
  | "GROUP_MEAL_COMPLETION"
  | "FULL_LOOP_COMPLETION"
  | "SHOPPING_COMPLETION"
  | "FRIDGE_MAINTENANCE"
  | "MEMORY_SHARE_STARTED_TOTAL"
  | "RECOMMENDATION_ADOPTED_TOTAL";

export type MedalCategory =
  | "MEAL_CHECKIN"
  | "DINING_COLLABORATION"
  | "RECOMMENDATION_CONTRIBUTION"
  | "HOLIDAY_LIMITED";

export type MedalTemplateStatus = "DRAFT" | "LISTED" | "UNLISTED" | "ARCHIVED";
export type MedalImageType = "earned" | "locked";

export interface MedalTemplateTransferItem {
  code: string;
  awardRule: MedalAwardRule;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  status: "LISTED";
  targetCount: number;
  sortOrder: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
}

export interface MedalTemplateTransferPackage {
  schemaVersion: "cook.medal-templates.v1";
  sourceEnvironment: "TEST";
  exportedAt: IsoDateTime;
  templates: MedalTemplateTransferItem[];
}

export interface MedalTemplateImportPreview {
  schemaVersion: "cook.medal-templates.v1";
  targetEnvironment: "ONLINE";
  sourceEnvironment: "TEST" | "UNKNOWN";
  counts: { total: number; new: number; existing: number };
  conflicts: string[];
}

export interface MedalTemplateImportResult {
  importedCount: number;
  createdCount: number;
  updatedCount: number;
}

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

export interface SetAdminMedalTemplateImageUrlPayload extends UpdateAdminMedalTemplateImagePayload {
  imageUrl: string;
}

export const medalApi = {
  list(query: AdminMedalTemplateQuery) {
    return requestData<PageResult<AdminMedalTemplateSummary>>("/admin/medal-templates", {
      query: { ...query }
    });
  },
  exportSelected(templateIds: number[]) {
    return requestData<MedalTemplateTransferPackage>("/admin/medal-templates/export", {
      method: "POST",
      body: { templateIds }
    });
  },
  previewImport(file: File) {
    const form = new FormData();
    form.append("file", file);
    return uploadForm<MedalTemplateImportPreview>("/admin/medal-templates/preview", form);
  },
  importPackage(file: File, operationId: OperationId) {
    const form = new FormData();
    form.append("file", file);
    return uploadForm<MedalTemplateImportResult>("/admin/medal-templates/import", form, { idempotencyKey: operationId });
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
  setImageUrl(templateId: UUID, imageType: MedalImageType, body: SetAdminMedalTemplateImageUrlPayload) {
    return requestData<AdminMedalTemplateSummary>(
      `/admin/medal-templates/${encodeURIComponent(String(templateId))}/image/${encodeURIComponent(imageType)}`,
      {
        method: "PUT",
        body: { expectedVersion: body.expectedVersion, imageUrl: body.imageUrl },
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
