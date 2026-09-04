import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const articleChannelCode = "KITCHEN";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
}

interface AdminSiteContentDetail {
  id: number;
  type: "PAGE" | "ARTICLE";
  status: "DRAFT" | "PUBLISHED" | "UNLISTED";
  channel: {
    id: number;
    code: string;
    name: string;
  } | null;
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

interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

interface KnowledgeArticleChannel {
  code: "KITCHEN" | "COOK" | "FOOD";
  name: string;
  description: string;
}

interface KnowledgeArticleSummary {
  id: number;
  title: string;
  summary: string;
  keywords: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

interface KnowledgeArticleList extends PageResult<KnowledgeArticleSummary> {
  channel: KnowledgeArticleChannel;
}

interface KnowledgeArticleDetail extends KnowledgeArticleSummary {
  slug: string;
  path: string;
  label: string;
  heroNote: string | null;
  bodyHtml: string;
  bodyText: string;
  updatedAt: string;
  channelCode: string;
  channelName: string;
  viewerHasLiked: boolean;
}

interface KnowledgeArticleViewResult {
  articleId: number;
  viewCount: number;
}

interface KnowledgeArticleLikeResult {
  articleId: number;
  likeCount: number;
  viewerHasLiked: boolean;
}

let idempotencySeed = Date.now();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function createFreshPhone() {
  const suffix = nextIdempotencyKey().slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

async function request<T>(path: string, options: RequestInit = {}, admin = false) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(admin
        ? {
            "x-cook-from": "admin_web",
            "x-admin-version": "0.1.0",
            "x-admin-build": "1"
          }
        : {
            "x-cook-from": "mini_program",
            "x-cook-version": "0.1.0"
          }),
      ...options.headers
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, admin = false) {
  const result = await request<T>(path, options, admin);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function loginWithCode(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

async function main() {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`.slice(-8);
  const slug = `knowledge-flow-${suffix}`;
  const expectedPath = `/guides/${slug}`;

  try {
    const channel = await prisma.siteContentChannel.findUnique({
      where: { code: articleChannelCode },
      select: { id: true, code: true, name: true, description: true }
    });
    assert(channel, `missing fixed channel ${articleChannelCode}`);

    const adminLogin = await requestData<LoginResult>(
      "/admin/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      },
      true
    );
    const adminAuth = { authorization: `Bearer ${adminLogin.token}` };

    const createOperationId = nextIdempotencyKey();
    const createBody = {
      type: "ARTICLE" as const,
      channelId: channel.id,
      slug,
      title: `厨房知识验收文章 ${suffix}`,
      summary: "用于验证厨房知识列表、详情、阅读和点赞链路。",
      keywords: "焯水; 去腥",
      label: "验收",
      heroNote: "自动化验收",
      coverImageUrl: null,
      bodyHtml: "<p>厨房知识验收正文</p>",
      bodyText: "厨房知识验收正文",
      effectiveAt: null,
      sortOrder: 0
    };
    const createOptions = {
      method: "POST",
      headers: withIdempotencyKey(adminAuth, createOperationId),
      body: JSON.stringify(createBody)
    };
    const [draftA, draftB] = await Promise.all([
      requestData<AdminSiteContentDetail>("/admin/content", createOptions, true),
      requestData<AdminSiteContentDetail>("/admin/content", createOptions, true)
    ]);
    assert(draftA.id === draftB.id, "concurrent article create replay should return the same row");
    assert(draftA.status === "DRAFT", "knowledge article should start as draft");

    const published = await requestData<AdminSiteContentDetail>(
      `/admin/content/${draftA.id}/status`,
      {
        method: "POST",
        headers: withIdempotencyKey(adminAuth),
        body: JSON.stringify({
          status: "PUBLISHED",
          expectedVersion: draftA.version
        })
      },
      true
    );
    assert(published.status === "PUBLISHED", "knowledge article should be published");
    assert(published.path === expectedPath, "knowledge article path should be normalized");

    const unauthenticatedList = await requestData<KnowledgeArticleList>(
      `/site-contents/articles?channelCode=${articleChannelCode}&page=1&pageSize=20`
    );
    assert(unauthenticatedList.channel.code === channel.code, "guest article list should expose current channel code");
    assert(
      unauthenticatedList.items.some(item => item.id === published.id),
      "guest article list should include published knowledge article"
    );

    const unauthenticatedDetail = await requestData<KnowledgeArticleDetail>(`/site-contents/articles/${published.id}`);
    assert(unauthenticatedDetail.id === published.id, "guest knowledge detail id mismatch");
    assert(unauthenticatedDetail.viewerHasLiked === false, "guest knowledge detail should not be marked liked");

    const unauthenticatedLike = await request(`/site-contents/articles/${published.id}/like`, {
      method: "POST",
      headers: withIdempotencyKey({})
    });
    assert(unauthenticatedLike.status === 200 && unauthenticatedLike.body.code === 401, "guest like should still require login");

    const userLogin = await loginWithCode(createFreshPhone());
    const userAuth = { authorization: `Bearer ${userLogin.token}` };

    const articleList = await requestData<KnowledgeArticleList>(
      `/site-contents/articles?channelCode=${articleChannelCode}&page=1&pageSize=20`,
      { headers: userAuth }
    );
    assert(articleList.channel.code === channel.code, "article list should expose current channel code");
    assert(articleList.channel.name === channel.name, "article list should expose current channel name");
    assert(articleList.channel.description === channel.description, "article list should expose current channel description");
    const listed = articleList.items.find(item => item.id === published.id);
    assert(listed, "published knowledge article should appear in list");
    assert(listed.summary === createBody.summary, "article list should expose summary");
    assert(listed.keywords === "焯水; 去腥", "article list should expose keywords");

    const detail = await requestData<KnowledgeArticleDetail>(`/site-contents/articles/${published.id}`, {
      headers: userAuth
    });
    assert(detail.id === published.id, "knowledge detail id mismatch");
    assert(detail.channelCode === articleChannelCode, "knowledge detail channel mismatch");
    assert(detail.summary === createBody.summary, "knowledge detail should expose summary");
    assert(detail.keywords === "焯水; 去腥", "knowledge detail should expose keywords");
    assert(detail.viewerHasLiked === false, "newly published knowledge article should start unliked");

    const initialViewCount = detail.viewCount;
    const initialLikeCount = detail.likeCount;

    const viewOperationId = nextIdempotencyKey();
    const viewed = await requestData<KnowledgeArticleViewResult>(
      `/site-contents/articles/${published.id}/view`,
      {
        method: "POST",
        headers: withIdempotencyKey(userAuth, viewOperationId)
      }
    );
    assert(viewed.articleId === published.id, "view result articleId mismatch");
    assert(viewed.viewCount === initialViewCount + 1, "view count should increment once");

    const viewReplay = await requestData<KnowledgeArticleViewResult>(
      `/site-contents/articles/${published.id}/view`,
      {
        method: "POST",
        headers: withIdempotencyKey(userAuth, viewOperationId)
      }
    );
    assert(viewReplay.viewCount === viewed.viewCount, "view replay should stay idempotent");

    const liked = await requestData<KnowledgeArticleLikeResult>(
      `/site-contents/articles/${published.id}/like`,
      {
        method: "POST",
        headers: withIdempotencyKey(userAuth)
      }
    );
    assert(liked.articleId === published.id, "like result articleId mismatch");
    assert(liked.viewerHasLiked === true, "like result should mark viewer as liked");
    assert(liked.likeCount === initialLikeCount + 1, "like count should increment once");

    const unliked = await requestData<KnowledgeArticleLikeResult>(
      `/site-contents/articles/${published.id}/like`,
      {
        method: "DELETE",
        headers: withIdempotencyKey(userAuth)
      }
    );
    assert(unliked.viewerHasLiked === false, "unlike result should clear like state");
    assert(unliked.likeCount === initialLikeCount, "unlike should restore like count");

    const finalDetail = await requestData<KnowledgeArticleDetail>(`/site-contents/articles/${published.id}`, {
      headers: userAuth
    });
    assert(finalDetail.viewCount === initialViewCount + 1, "detail should expose incremented view count");
    assert(finalDetail.likeCount === initialLikeCount, "detail should expose restored like count");
    assert(finalDetail.viewerHasLiked === false, "detail should expose final unlike state");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          channelCode: articleChannelCode,
          articleId: published.id,
          unauthenticatedListStatus: 200,
          unauthenticatedDetailStatus: 200,
          unauthenticatedLikeStatus: unauthenticatedLike.status,
          listedArticleId: listed.id,
          finalViewCount: finalDetail.viewCount,
          finalLikeCount: finalDetail.likeCount
        },
        null,
        2
      )
    );
  } finally {
    await prisma.siteContent.deleteMany({
      where: { slug }
    }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
