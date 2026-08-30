import { cfg } from "@/config";
import { get, type PageResult } from "@/apis/http";

export interface OfficialMessageSummary {
  id: number;
  type: "ARTICLE";
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

export interface OfficialMessageDetail extends OfficialMessageSummary {}

const baseUrl = `${cfg.domain}/api/site-contents/official-messages`;
const assetHost = cfg.domain.replace(/\/+$/u, "");

function toAssetUrl(value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//iu.test(value)) return value;
  if (value.startsWith("/")) return `${assetHost}${value}`;
  return value;
}

function normalizeBodyHtml(value: string) {
  return value.replace(/(<img\b[^>]*\bsrc=(['"]))([^"'<>]+)\2/giu, (_matched, prefix: string, quote: string, src: string) => {
    const nextSrc = toAssetUrl(src) ?? src;
    return `${prefix}${nextSrc}${quote}`;
  });
}

function normalizeItem<T extends OfficialMessageSummary>(item: T): T {
  return {
    ...item,
    coverImageUrl: toAssetUrl(item.coverImageUrl),
    bodyHtml: normalizeBodyHtml(item.bodyHtml)
  };
}

export const officialMessageApi = {
  listMessages(page = 1, pageSize = 20) {
    return get<PageResult<OfficialMessageSummary>>(baseUrl, { page, pageSize }).then(result => ({
      ...result,
      items: result.items.map(item => normalizeItem(item))
    }));
  },
  getDetail(messageId: number) {
    return get<OfficialMessageDetail>(`${baseUrl}/${encodeURIComponent(String(messageId))}`).then(item => normalizeItem(item));
  }
};
