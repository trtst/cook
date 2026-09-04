export interface SiteContentDetail {
  id: number;
  type: "PAGE" | "ARTICLE";
  slug: string;
  path: string;
  title: string;
  summary: string;
  label: string;
  heroNote: string | null;
  coverImageUrl: string | null;
  bodyHtml: string;
  bodyText: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  updatedAt: string;
  channelCode: string | null;
  channelName: string | null;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  serverTime: string;
}

export class ApiClientError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function resolveSiteContent(path: string) {
  const response = await fetch(`/api/site-contents/resolve?path=${encodeURIComponent(path)}`, {
    cache: "no-store"
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<SiteContentDetail> | null;

  if (!body) throw new HttpError(response.status, "响应格式不符合契约");
  if (!response.ok) throw new HttpError(response.status, "请求失败");
  if (body.code !== 0) throw new ApiClientError(body.code, body.message);

  return body.data;
}
