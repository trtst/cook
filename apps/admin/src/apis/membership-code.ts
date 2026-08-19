import { requestData, type IsoDateTime, type OperationId, type PageQuery, type PageResult, type UUID } from "./http";

export type MembershipCodeKind = "FORMAL" | "TRIAL";
export type MembershipCodeStatus = "ACTIVE" | "REDEEMED" | "DISABLED";
export type MembershipCodeBatchWindowState = "NO_LIMIT" | "PENDING" | "ACTIVE" | "EXPIRED";
export type EntitlementTier = "FREE" | "PLUS" | "PRO" | "ULTRA";
export type MembershipSkuCode = "PLUS_30D" | "PRO_30D" | "PRO_TRIAL_1D" | "PRO_TRIAL_3D" | "PRO_TRIAL_7D";

export interface AdminMembershipSkuItem {
  id: UUID;
  code: MembershipSkuCode;
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  redeemEnabled: boolean;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMembershipSkuListResponse {
  items: AdminMembershipSkuItem[];
  syncedAt: IsoDateTime;
}

export interface SetAdminMembershipSkuStatusRequest {
  operationId: OperationId;
  redeemEnabled: boolean;
  expectedVersion: number;
}

export interface AdminMembershipCodeBatchItem {
  id: UUID;
  sku: AdminMembershipSkuItem;
  name: string;
  redeemEnabled: boolean;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  windowState: MembershipCodeBatchWindowState;
  version: number;
  codeCount: number;
  activeCodeCount: number;
  redeemedCodeCount: number;
  disabledCodeCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMembershipCodeQuery extends PageQuery {
  batchId?: UUID;
  status?: MembershipCodeStatus;
  code?: string;
}

export interface AdminMembershipCodeGenerationQuery extends PageQuery {
  batchId?: UUID;
  skuCode?: MembershipSkuCode;
}

export interface AdminMembershipCodeRedemptionQuery extends PageQuery {
  batchId?: UUID;
  skuCode?: MembershipSkuCode;
  uid?: number;
  redeemedFrom?: IsoDateTime;
  redeemedTo?: IsoDateTime;
  code?: string;
}

export interface AdminMembershipCodeBatchQuery extends PageQuery {
  keyword?: string;
  skuCode?: MembershipSkuCode;
  redeemEnabled?: boolean;
}

export interface CreateAdminMembershipCodeBatchRequest {
  operationId: OperationId;
  skuCode: MembershipSkuCode;
  name: string;
  redeemEnabled: boolean;
  startsAt?: IsoDateTime | null;
  endsAt?: IsoDateTime | null;
}

export interface SetAdminMembershipCodeBatchStatusRequest {
  operationId: OperationId;
  redeemEnabled: boolean;
  expectedVersion: number;
}

export interface GenerateAdminMembershipCodesRequest {
  operationId: OperationId;
  quantity: number;
}

export interface AdminMembershipCodeOperatorSummary {
  id: UUID;
  uid: number;
  nickname: string | null;
}

export interface AdminMembershipCodeItem {
  id: UUID;
  batchId: UUID;
  batchName: string;
  skuCode: MembershipSkuCode;
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  codeMask: string;
  status: MembershipCodeStatus;
  redeemedBy: AdminMembershipCodeOperatorSummary | null;
  redeemedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface GeneratedMembershipCodeRow {
  code: string;
  codeMask: string;
}

export interface AdminMembershipCodeGenerationOperatorSummary {
  id: UUID;
  username: string;
  displayName: string;
}

export interface AdminMembershipCodeGenerationItem {
  id: UUID;
  batchId: UUID;
  batchName: string;
  skuCode: MembershipSkuCode;
  generatedCount: number;
  generatedBy: AdminMembershipCodeGenerationOperatorSummary | null;
  exportedAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface AdminGenerateMembershipCodesResult {
  batch: AdminMembershipCodeBatchItem;
  generatedCount: number;
  exportedAt: IsoDateTime;
  codes: GeneratedMembershipCodeRow[];
}

export const membershipCodeApi = {
  listSkus() {
    return requestData<AdminMembershipSkuListResponse>("/admin/membership-codes/skus");
  },
  setSkuStatus(skuId: UUID, body: SetAdminMembershipSkuStatusRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminMembershipSkuItem>(`/admin/membership-codes/skus/${encodeURIComponent(String(skuId))}/status`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  listBatches(query: AdminMembershipCodeBatchQuery) {
    return requestData<PageResult<AdminMembershipCodeBatchItem>>("/admin/membership-codes/batches", {
      query: { ...query }
    });
  },
  createBatch(body: CreateAdminMembershipCodeBatchRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminMembershipCodeBatchItem>("/admin/membership-codes/batches", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  setBatchStatus(batchId: UUID, body: SetAdminMembershipCodeBatchStatusRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminMembershipCodeBatchItem>(`/admin/membership-codes/batches/${encodeURIComponent(String(batchId))}/status`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  generateCodes(batchId: UUID, body: GenerateAdminMembershipCodesRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminGenerateMembershipCodesResult>(`/admin/membership-codes/batches/${encodeURIComponent(String(batchId))}/generate`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  listCodes(query: AdminMembershipCodeQuery) {
    return requestData<PageResult<AdminMembershipCodeItem>>("/admin/membership-codes", {
      query: { ...query }
    });
  },
  listGenerations(query: AdminMembershipCodeGenerationQuery) {
    return requestData<PageResult<AdminMembershipCodeGenerationItem>>("/admin/membership-codes/generations", {
      query: { ...query }
    });
  },
  listRedemptions(query: AdminMembershipCodeRedemptionQuery) {
    return requestData<PageResult<AdminMembershipCodeItem>>("/admin/membership-codes/redemptions", {
      query: { ...query }
    });
  },
  disableCode(codeId: UUID, operationId: OperationId) {
    return requestData<AdminMembershipCodeItem>(`/admin/membership-codes/${encodeURIComponent(String(codeId))}/disable`, {
      method: "POST",
      idempotencyKey: operationId
    });
  }
};
