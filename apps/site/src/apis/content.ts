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
}

export async function resolveSiteContent(path: string) {
  const response = await fetch(`/api/site-contents/resolve?path=${encodeURIComponent(path)}`, {
    cache: "no-store"
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<SiteContentDetail> | null;
  if (!response.ok || !body || body.code !== 0) {
    throw new Error(body?.message ?? "内容读取失败");
  }
  return body.data;
}
