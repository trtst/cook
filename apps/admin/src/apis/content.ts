import { requestData, uploadForm, type IsoDateTime, type OperationId, type PageQuery, type PageResult, type UUID } from "./http";

export type SiteContentType = "PAGE" | "ARTICLE";
export type SiteContentStatus = "DRAFT" | "PUBLISHED" | "UNLISTED";

export interface AdminSiteContentChannelItem {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminSiteContentOperator {
  id: UUID;
  username: string;
  displayName: string;
}

export interface AdminSiteContentSummary {
  id: UUID;
  type: SiteContentType;
  status: SiteContentStatus;
  channel: AdminSiteContentChannelItem | null;
  slug: string;
  path: string;
  title: string;
  summary: string;
  label: string;
  heroNote: string | null;
  coverImageUrl: string | null;
  publishedAt: IsoDateTime | null;
  effectiveAt: IsoDateTime | null;
  sortOrder: number;
  version: number;
  updatedBy: AdminSiteContentOperator | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminSitePageSummary extends AdminSiteContentSummary {
  exists: boolean;
  fixedSlug: string;
}

export interface AdminSiteContentDetail extends AdminSiteContentSummary {
  bodyHtml: string;
  bodyText: string;
}

export interface AdminSiteContentArticleQuery extends PageQuery {
  channelId?: UUID;
  status?: SiteContentStatus;
  keyword?: string;
}

export interface AdminSiteContentChannelQuery extends PageQuery {
  code?: string;
}

export interface CreateAdminSiteContentChannelRequest {
  operationId: OperationId;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateAdminSiteContentChannelRequest extends CreateAdminSiteContentChannelRequest {
  expectedVersion: number;
}

export interface SaveAdminSiteContentRequest {
  operationId: OperationId;
  type: SiteContentType;
  channelId?: UUID | null;
  slug: string;
  path?: string | null;
  title: string;
  summary: string;
  label: string;
  heroNote?: string | null;
  coverImageUrl?: string | null;
  bodyHtml: string;
  bodyText: string;
  effectiveAt?: IsoDateTime | null;
  sortOrder?: number;
}

export interface UpdateAdminSiteContentRequest extends SaveAdminSiteContentRequest {
  expectedVersion: number;
}

export interface SetAdminSiteContentStatusRequest {
  operationId: OperationId;
  status: SiteContentStatus;
  expectedVersion: number;
}

export interface AdminSiteContentImageUploadResult {
  imageUrl: string;
}

export const contentApi = {
  listChannels(query: AdminSiteContentChannelQuery) {
    return requestData<PageResult<AdminSiteContentChannelItem>>("/admin/content/channels", {
      query: { ...query }
    });
  },
  createChannel(body: CreateAdminSiteContentChannelRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminSiteContentChannelItem>("/admin/content/channels", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  updateChannel(channelId: UUID, body: UpdateAdminSiteContentChannelRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminSiteContentChannelItem>(`/admin/content/channels/${encodeURIComponent(String(channelId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  listPages() {
    return requestData<PageResult<AdminSitePageSummary>>("/admin/content/pages");
  },
  listArticles(query: AdminSiteContentArticleQuery) {
    return requestData<PageResult<AdminSiteContentSummary>>("/admin/content/articles", {
      query: { ...query }
    });
  },
  getDetail(contentId: UUID) {
    return requestData<AdminSiteContentDetail>(`/admin/content/${encodeURIComponent(String(contentId))}`);
  },
  createContent(body: SaveAdminSiteContentRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminSiteContentDetail>("/admin/content", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  updateContent(contentId: UUID, body: UpdateAdminSiteContentRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminSiteContentDetail>(`/admin/content/${encodeURIComponent(String(contentId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  setStatus(contentId: UUID, body: SetAdminSiteContentStatusRequest) {
    const { operationId, ...payload } = body;
    return requestData<AdminSiteContentDetail>(`/admin/content/${encodeURIComponent(String(contentId))}/status`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  uploadImage(file: File, operationId: OperationId) {
    const formData = new FormData();
    formData.append("file", file);
    return uploadForm<AdminSiteContentImageUploadResult>("/admin/content/images", formData, {
      idempotencyKey: operationId
    });
  }
};
