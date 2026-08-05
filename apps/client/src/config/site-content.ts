import { cfg } from "./env";

export type SiteContentSlug =
  | "about"
  | "privacy"
  | "terms"
  | "faq"
  | "kitchen-prep"
  | "cooking-skills"
  | "recipe-skills"
  | "product"
  | "scenes"
  | "changelog";

interface SiteContentMeta {
  title: string;
  path: string;
}

const siteContentMap: Record<SiteContentSlug, SiteContentMeta> = {
  about: { title: "关于炊火记", path: "https://www.trtst.com/about" },
  privacy: { title: "隐私政策", path: "/privacy" },
  terms: { title: "用户协议", path: "/terms" },
  faq: { title: "常见问题", path: "/faq" },
  "kitchen-prep": { title: "厨房准备", path: "/guides/kitchen-prep" },
  "cooking-skills": { title: "烹饪技巧", path: "/guides/cooking-skills" },
  "recipe-skills": { title: "食谱技巧", path: "/guides/recipe-skills" },
  product: { title: "产品介绍", path: "/product" },
  scenes: { title: "适用场景", path: "/scenes" },
  changelog: { title: "更新日志", path: "/changelog" }
};

export function resolveSiteContent(slug: string | undefined) {
  if (!slug) return null;
  return siteContentMap[slug as SiteContentSlug] ?? null;
}

export function buildSiteContentUrl(slug: SiteContentSlug) {
  const meta = siteContentMap[slug];
  if (/^https?:\/\//u.test(meta.path)) {
    return meta.path;
  }

  const baseUrl = cfg.siteUrl.replace(/\/+$/u, "");
  return `${baseUrl}${meta.path}?source=mini_program`;
}
