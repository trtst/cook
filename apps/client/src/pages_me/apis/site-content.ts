import { get } from "@/apis/http";
import { cfg } from "@/config";

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

const baseUrl = `${cfg.domain}/api/site-contents/resolve`;
const assetHost = cfg.domain.replace(/\/+$/u, "");

function normalizeBodyHtml(value: string) {
  return value.replace(/(<img\b[^>]*\bsrc=(['"]))([^"'<>]+)\2/giu, (_matched, prefix: string, quote: string, src: string) => {
    const assetUrl = /^https?:\/\//iu.test(src) ? src : src.startsWith("/") ? `${assetHost}${src}` : src;
    return `${prefix}${assetUrl}${quote}`;
  });
}

export const siteContentApi = {
  getPublishedPage(path: string) {
    return get<SiteContentDetail>(baseUrl, { path }, { auth: false }).then(detail => ({
      ...detail,
      bodyHtml: normalizeBodyHtml(detail.bodyHtml)
    }));
  }
};
