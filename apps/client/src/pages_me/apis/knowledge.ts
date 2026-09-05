/**
 * 我的分包厨房知识请求层。
 *
 * 厨房知识当前只由 `pages_me` 分包页面消费，放在分包内可以避免
 * uni-app 把它编译到主包根目录，造成主包未使用 JS 提示。
 */
import { cfg } from "@/config";
import { del, get, post, UnauthorizedError, type OperationId, type PageResult } from "@/apis/http";
import type { KnowledgeChannelCode } from "@/config/knowledge-articles";

export interface KnowledgeArticleSummary {
  id: number;
  title: string;
  summary: string;
  keywords: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

export interface KnowledgeArticleChannel {
  code: KnowledgeChannelCode;
  name: string;
  description: string;
}

export interface KnowledgeArticleList extends PageResult<KnowledgeArticleSummary> {
  channel: KnowledgeArticleChannel;
}

export interface KnowledgeArticleDetail extends KnowledgeArticleSummary {
  slug: string;
  path: string;
  label: string;
  heroNote: string | null;
  bodyHtml: string;
  bodyText: string;
  updatedAt: string;
  channelCode: KnowledgeChannelCode;
  channelName: string;
  viewerHasLiked: boolean;
}

export interface KnowledgeArticleLikeResult {
  articleId: number;
  likeCount: number;
  viewerHasLiked: boolean;
}

export interface KnowledgeArticleViewResult {
  articleId: number;
  viewCount: number;
}

const baseUrl = `${cfg.domain}/api/site-contents/articles`;
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

function normalizeSummary(item: KnowledgeArticleSummary): KnowledgeArticleSummary {
  return {
    ...item,
    coverImageUrl: toAssetUrl(item.coverImageUrl)
  };
}

function normalizeDetail(item: KnowledgeArticleDetail): KnowledgeArticleDetail {
  return {
    ...item,
    coverImageUrl: toAssetUrl(item.coverImageUrl),
    bodyHtml: normalizeBodyHtml(item.bodyHtml)
  };
}

async function getReadable<T>(url: string, query?: Record<string, string | number | boolean | null | undefined>) {
  try {
    return await get<T>(url, query, { auth: "optional" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return get<T>(url, query, { auth: false });
    }
    throw error;
  }
}

export const knowledgeApi = {
  listArticles(channelCode: KnowledgeChannelCode, page = 1, pageSize = 20) {
    return getReadable<KnowledgeArticleList>(baseUrl, {
      channelCode,
      page,
      pageSize
    }).then(result => ({
      ...result,
      items: result.items.map(normalizeSummary)
    }));
  },
  getArticleDetail(articleId: number) {
    return getReadable<KnowledgeArticleDetail>(`${baseUrl}/${encodeURIComponent(String(articleId))}`).then(normalizeDetail);
  },
  recordArticleView(articleId: number, operationId: OperationId) {
    return post<KnowledgeArticleViewResult>(`${baseUrl}/${encodeURIComponent(String(articleId))}/view`, undefined, {
      idempotencyKey: operationId
    });
  },
  likeArticle(articleId: number, operationId: OperationId) {
    return post<KnowledgeArticleLikeResult>(`${baseUrl}/${encodeURIComponent(String(articleId))}/like`, undefined, {
      idempotencyKey: operationId
    });
  },
  unlikeArticle(articleId: number, operationId: OperationId) {
    return del<KnowledgeArticleLikeResult>(`${baseUrl}/${encodeURIComponent(String(articleId))}/like`, undefined, {
      idempotencyKey: operationId
    });
  }
};
