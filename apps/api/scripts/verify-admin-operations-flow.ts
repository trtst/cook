import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { hashPassword } from "../src/common/security/password";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const expectedFixedPageSlugs = ["about", "privacy", "terms", "product", "faq"] as const;

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AdminLoginResult {
  token: string;
  admin: { id: number; username: string };
}

interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

interface AdminDashboardTrendsResponse {
  range: "7D" | "30D";
  points: Array<{
    date: string;
    label: string;
    newUsers: number;
    totalUsers: number;
    openReportCount: number;
    pendingRecipeCount: number;
    pendingIngredientCount: number;
    membershipGeneratedCount: number;
    membershipRedeemedCount: number;
  }>;
}

interface AdminSiteContentChannelItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  version: number;
}

interface AdminSitePageSummary {
  id: number;
  type: "PAGE";
  status: "DRAFT" | "PUBLISHED" | "UNLISTED";
  slug: string;
  path: string;
  title: string;
  summary: string;
  label: string;
  fixedSlug: string;
  exists: boolean;
}

interface AdminSiteContentDetail {
  id: number;
  type: "PAGE" | "ARTICLE";
  status: "DRAFT" | "PUBLISHED" | "UNLISTED";
  channel: AdminSiteContentChannelItem | null;
  slug: string;
  path: string;
  title: string;
  summary: string;
  label: string;
  heroNote: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  effectiveAt: string | null;
  sortOrder: number;
  version: number;
  bodyHtml: string;
  bodyText: string;
}

interface SiteContentDetail {
  id: number;
  type: "PAGE" | "ARTICLE";
  slug: string;
  path: string;
  title: string;
  summary: string;
  bodyHtml: string;
  channelCode: string | null;
}

let idempotencySeed = Date.now();

const adminHeaders = {
  "content-type": "application/json",
  "x-cook-from": "admin_web",
  "x-admin-version": "0.1.0",
  "x-admin-build": "1"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

async function request<T>(path: string, options: RequestInit = {}, headers: Record<string, string> = adminHeaders) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, headers: Record<string, string> = adminHeaders) {
  const result = await request<T>(path, options, headers);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function main() {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`.slice(-8);
  const limitedUsername = `ops_limited_${suffix}`;
  const limitedPassword = "change-me";
  const channelCode = `OPS_${suffix}`;
  const slug = `ops-guide-${suffix}`;
  const articlePath = `/guides/${slug}`;

  try {
    const unauthenticatedTrends = await request<AdminDashboardTrendsResponse>("/admin/dashboard/trends?range=7D");
    assert(unauthenticatedTrends.status === 401, "unauthenticated dashboard trends should return 401");

    const unauthenticatedArticles = await request<PageResult<AdminSiteContentDetail>>("/admin/content/articles?page=1&pageSize=20");
    assert(unauthenticatedArticles.status === 401, "unauthenticated content articles should return 401");

    await prisma.adminAccount.create({
      data: {
        username: limitedUsername,
        displayName: "运营只读验证",
        passwordHash: hashPassword(limitedPassword),
        roles: [],
        status: "ACTIVE"
      }
    });

    const limitedLogin = await requestData<AdminLoginResult>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: limitedUsername, password: limitedPassword })
    });
    const limitedAuth = { authorization: `Bearer ${limitedLogin.token}` };

    const limitedTrends = await request<AdminDashboardTrendsResponse>("/admin/dashboard/trends?range=7D", {
      headers: limitedAuth
    });
    assert(limitedTrends.status === 403, "non-super-admin dashboard trends should return 403");

    const limitedChannels = await request<PageResult<AdminSiteContentChannelItem>>("/admin/content/channels?page=1&pageSize=20", {
      headers: limitedAuth
    });
    assert(limitedChannels.status === 403, "non-super-admin content channels should return 403");

    const adminLogin = await requestData<AdminLoginResult>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });
    const adminAuth = { authorization: `Bearer ${adminLogin.token}` };

    const trends = await requestData<AdminDashboardTrendsResponse>("/admin/dashboard/trends?range=7D", {
      headers: adminAuth
    });
    assert(trends.range === "7D", "dashboard trends range mismatch");
    assert(trends.points.length === 7, "dashboard trends should return 7 points");

    const fixedPages = await requestData<PageResult<AdminSitePageSummary>>("/admin/content/pages", {
      headers: adminAuth
    });
    assert(fixedPages.items.length === expectedFixedPageSlugs.length, "fixed page count mismatch");
    for (const slug of expectedFixedPageSlugs) {
      const page = fixedPages.items.find(item => item.slug === slug);
      assert(page, `missing fixed page: ${slug}`);
      assert(page.exists === true, `fixed page should exist: ${slug}`);
      assert(page.type === "PAGE", `fixed page type mismatch: ${slug}`);
    }

    const createChannelOperationId = nextIdempotencyKey();
    const createChannelBody = {
      code: channelCode,
      name: `运营验证栏目 ${suffix}`,
      description: "后台运营治理验证栏目",
      sortOrder: 91
    };
    const createChannelOptions = {
      method: "POST",
      headers: withIdempotencyKey(adminAuth, createChannelOperationId),
      body: JSON.stringify(createChannelBody)
    };
    const [channelA, channelB] = await Promise.all([
      requestData<AdminSiteContentChannelItem>("/admin/content/channels", createChannelOptions),
      requestData<AdminSiteContentChannelItem>("/admin/content/channels", createChannelOptions)
    ]);
    assert(channelA.id === channelB.id, "channel idempotent replay should return the same row");
    assert(channelA.code === channelCode, "channel code mismatch after create");

    const changedChannelReplay = await request<AdminSiteContentChannelItem>(
      "/admin/content/channels",
      {
        method: "POST",
        headers: withIdempotencyKey(adminAuth, createChannelOperationId),
        body: JSON.stringify({ ...createChannelBody, name: `运营验证栏目 ${suffix} B` })
      }
    );
    assert(changedChannelReplay.status === 409, "reusing channel Idempotency-Key with different body should return 409");

    const updatedChannel = await requestData<AdminSiteContentChannelItem>(
      `/admin/content/channels/${channelA.id}`,
      {
        method: "PUT",
        headers: withIdempotencyKey(adminAuth),
        body: JSON.stringify({
          code: channelCode,
          name: `运营验证栏目 ${suffix} 已更新`,
          description: "后台运营治理验证栏目已更新",
          sortOrder: 92,
          expectedVersion: channelA.version
        })
      }
    );
    assert(updatedChannel.version === channelA.version + 1, "channel update should increment version");

    const staleChannelUpdate = await request<AdminSiteContentChannelItem>(
      `/admin/content/channels/${channelA.id}`,
      {
        method: "PUT",
        headers: withIdempotencyKey(adminAuth),
        body: JSON.stringify({
          code: channelCode,
          name: `运营验证栏目 ${suffix} 旧版本`,
          description: "旧版本冲突校验",
          sortOrder: 93,
          expectedVersion: channelA.version
        })
      }
    );
    assert(staleChannelUpdate.status === 409, "stale channel expectedVersion should return 409");

    const createContentOperationId = nextIdempotencyKey();
    const createContentBody = {
      type: "ARTICLE" as const,
      channelId: updatedChannel.id,
      slug,
      title: `运营治理验证文章 ${suffix}`,
      summary: "用于校验后台内容治理的幂等、状态和公开读取。",
      label: "验证",
      heroNote: "自动化验证",
      coverImageUrl: null,
      bodyHtml: "<p>运营治理验证正文</p>",
      bodyText: "运营治理验证正文",
      effectiveAt: null,
      sortOrder: 0
    };
    const createContentOptions = {
      method: "POST",
      headers: withIdempotencyKey(adminAuth, createContentOperationId),
      body: JSON.stringify(createContentBody)
    };
    const [contentA, contentB] = await Promise.all([
      requestData<AdminSiteContentDetail>("/admin/content", createContentOptions),
      requestData<AdminSiteContentDetail>("/admin/content", createContentOptions)
    ]);
    assert(contentA.id === contentB.id, "content idempotent replay should return the same row");
    assert(contentA.status === "DRAFT", "new content should start as draft");
    assert(contentA.path === articlePath, "article path should be normalized by server");

    const changedContentReplay = await request<AdminSiteContentDetail>(
      "/admin/content",
      {
        method: "POST",
        headers: withIdempotencyKey(adminAuth, createContentOperationId),
        body: JSON.stringify({ ...createContentBody, title: `运营治理验证文章 ${suffix} B` })
      }
    );
    assert(changedContentReplay.status === 409, "reusing content Idempotency-Key with different body should return 409");

    const draftResolve = await request<SiteContentDetail>(`/site-contents/resolve?path=${encodeURIComponent(articlePath)}`, {
      headers: {
        "x-cook-from": "site_web",
        "x-cook-version": "0.1.0",
        "x-cook-build": "1"
      }
    });
    assert(draftResolve.status === 404, "draft content should not be publicly resolvable");

    const publishedContent = await requestData<AdminSiteContentDetail>(
      `/admin/content/${contentA.id}/status`,
      {
        method: "POST",
        headers: withIdempotencyKey(adminAuth),
        body: JSON.stringify({
          status: "PUBLISHED",
          expectedVersion: contentA.version
        })
      }
    );
    assert(publishedContent.status === "PUBLISHED", "content should be published");
    assert(publishedContent.version === contentA.version + 1, "publish should increment content version");

    const publicContent = await requestData<SiteContentDetail>(`/site-contents/resolve?path=${encodeURIComponent(articlePath)}`, {
      headers: {
        "x-cook-from": "site_web",
        "x-cook-version": "0.1.0",
        "x-cook-build": "1"
      }
    });
    assert(publicContent.path === articlePath, "published content public path mismatch");
    assert(publicContent.title === publishedContent.title, "published content public title mismatch");

    const staleStatusUpdate = await request<AdminSiteContentDetail>(
      `/admin/content/${contentA.id}/status`,
      {
        method: "POST",
        headers: withIdempotencyKey(adminAuth),
        body: JSON.stringify({
          status: "UNLISTED",
          expectedVersion: contentA.version
        })
      }
    );
    assert(staleStatusUpdate.status === 409, "stale content expectedVersion should return 409");

    const unpublishedContent = await requestData<AdminSiteContentDetail>(
      `/admin/content/${contentA.id}/status`,
      {
        method: "POST",
        headers: withIdempotencyKey(adminAuth),
        body: JSON.stringify({
          status: "UNLISTED",
          expectedVersion: publishedContent.version
        })
      }
    );
    assert(unpublishedContent.status === "UNLISTED", "content should become unlisted");

    const hiddenResolve = await request<SiteContentDetail>(`/site-contents/resolve?path=${encodeURIComponent(articlePath)}`, {
      headers: {
        "x-cook-from": "site_web",
        "x-cook-version": "0.1.0",
        "x-cook-build": "1"
      }
    });
    assert(hiddenResolve.status === 404, "unlisted content should not be publicly resolvable");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          unauthenticatedTrendsStatus: unauthenticatedTrends.status,
          unauthenticatedArticlesStatus: unauthenticatedArticles.status,
          limitedTrendsStatus: limitedTrends.status,
          limitedChannelsStatus: limitedChannels.status,
          trendsPoints: trends.points.length,
          fixedPageCount: fixedPages.items.length,
          createdChannelId: channelA.id,
          createdContentId: contentA.id,
          publicContentPath: publicContent.path,
          staleChannelUpdateStatus: staleChannelUpdate.status,
          staleStatusUpdateStatus: staleStatusUpdate.status
        },
        null,
        2
      )
    );
  } finally {
    await prisma.siteContent
      .deleteMany({
        where: { slug }
      })
      .catch(() => undefined);
    await prisma.siteContentChannel
      .deleteMany({
        where: { code: channelCode }
      })
      .catch(() => undefined);
    await prisma.adminAccount
      .deleteMany({
        where: { username: limitedUsername }
      })
      .catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
