import { requestData, type IsoDateTime, type OperationId, type PageQuery, type PageResult, type UUID } from "./http";

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
  code: string;
  awardRule: MedalAwardRule;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  iconKey: string;
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
  iconKey: string;
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
  }
};
