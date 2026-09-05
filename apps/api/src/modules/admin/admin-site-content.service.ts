import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type SiteContentStatus, type SiteContentType } from "@prisma/client";
import {
  completeAdminIdempotentOperation,
  completeIdempotentOperation,
  getAdminIdempotentResult,
  getIdempotentResult,
  startAdminIdempotentOperation,
  startIdempotentOperation
} from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import { sanitizeContentHtml } from "./content-html";
import type {
  AdminSiteContentChannelSummary,
  AdminSiteContentDetail,
  AdminSiteContentSummary,
  AdminSitePageSummary,
  CreateAdminSiteContentChannelRequest,
  CreateAdminSiteContentRequest,
  PageResult,
  SiteContentArticleDetail,
  SiteContentArticleList,
  SiteContentArticleLikeResult,
  SiteContentArticleSummary,
  SiteContentArticleViewResult,
  SiteContentDetail,
  UUID,
  UpdateAdminSiteContentChannelRequest,
  UpdateAdminSiteContentRequest,
  AdminSiteContentDeleteResult,
  UpdateAdminSiteContentStatusRequest
} from "../../contracts/types";

type ContentRow = Prisma.SiteContentGetPayload<{
  include: {
    channel: true;
    updatedByAdmin: true;
  };
}>;

type ChannelRow = Prisma.SiteContentChannelGetPayload<Record<string, never>>;

type FixedPageSeed = {
  slug: string;
  path: string;
  title: string;
  label: string;
  channelCode: string;
  sortOrder: number;
};

const defaultChannelSeeds = [
  { code: "ABOUT", name: "关于", description: "官网品牌与团队固定页", sortOrder: 0 },
  { code: "LEGAL", name: "法务", description: "隐私政策与用户协议", sortOrder: 1 },
  { code: "HELP", name: "帮助", description: "FAQ 与内容帮助页", sortOrder: 2 },
  { code: "OFFICIAL_NOTICE", name: "官方消息", description: "站内官方消息与通知中心承接", sortOrder: 3 },
  { code: "PRE_MEAL", name: "餐前准备", description: "备菜与准备类文章", sortOrder: 4 },
  { code: "KITCHEN_KNOWLEDGE", name: "厨房知识", description: "厨房经验与做饭知识文章", sortOrder: 5 },
  { code: "KITCHEN", name: "厨房百事", description: "用什么、怎么买、怎么存、怎么备", sortOrder: 6 },
  { code: "COOK", name: "烹调技法", description: "怎么做、为什么这样做、失败怎么救", sortOrder: 7 },
  { code: "FOOD", name: "饮食文化", description: "餐桌上的节气、地域、传统、人情", sortOrder: 8 }
] as const;

const publicArticleChannels = [
  { code: "KITCHEN", name: "厨房百事" },
  { code: "COOK", name: "烹调技法" },
  { code: "FOOD", name: "饮食文化" }
] as const;

type PublicArticleChannelCode = (typeof publicArticleChannels)[number]["code"];
const officialMessageChannelCode = "OFFICIAL_NOTICE" as const;
const fixedPageSeeds: FixedPageSeed[] = [
  { slug: "about", path: "/about", title: "关于我们", label: "关于", channelCode: "ABOUT", sortOrder: 0 },
  { slug: "privacy", path: "/privacy", title: "隐私政策", label: "法务", channelCode: "LEGAL", sortOrder: 1 },
  { slug: "terms", path: "/terms", title: "用户协议", label: "法务", channelCode: "LEGAL", sortOrder: 2 },
  { slug: "product", path: "/product", title: "产品介绍", label: "产品", channelCode: "ABOUT", sortOrder: 3 },
  { slug: "faq", path: "/faq", title: "FAQ", label: "帮助", channelCode: "HELP", sortOrder: 4 }
] as const;

function toIsoDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTextFromHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeKeywords(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  const items = text
    .replace(/；/g, ";")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean);
  const keywords = items.join("; ");
  if (keywords.length > 200) throw new BadRequestException("关键词不能超过 200 字符");
  return keywords || null;
}

function toRequestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isPublicArticleChannelCode(value: string): value is PublicArticleChannelCode {
  return publicArticleChannels.some(item => item.code === value);
}

@Injectable()
export class AdminSiteContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listChannels(page: number, pageSize: number, code: string | undefined, adminId: UUID): Promise<PageResult<AdminSiteContentChannelSummary>> {
    await this.requireSuperAdmin(adminId);
    await this.ensureDefaultChannels();
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(100, toPositiveInt(pageSize, 20));
    const normalizedCode = code?.trim().toUpperCase();
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.SiteContentChannelWhereInput = normalizedCode ? { code: { contains: normalizedCode, mode: "insensitive" } } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.siteContentChannel.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.siteContentChannel.count({ where })
    ]);

    return {
      items: items.map(item => this.toChannelSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createChannel(body: CreateAdminSiteContentChannelRequest, adminId: UUID) {
    await this.requireSuperAdmin(adminId);
    const code = normalizeCode(body.code);
    const requestHash = toRequestHash({ code, name: body.name, description: body.description ?? null, sortOrder: body.sortOrder ?? null });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminSiteContentChannelSummary>(tx, body.operationId, "admin-site-content-channel:create", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-site-content-channel:create", adminId, requestHash);

      const created = await tx.siteContentChannel.create({
        data: {
          code,
          name: body.name.trim(),
          description: body.description?.trim() || null,
          sortOrder: body.sortOrder ?? (await this.nextChannelSortOrder(tx))
        }
      });
      const result = this.toChannelSummary(created);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-site-content-channel:create", adminId, requestHash, result);
      return result;
    });
  }

  async updateChannel(channelId: UUID, body: UpdateAdminSiteContentChannelRequest, adminId: UUID) {
    await this.requireSuperAdmin(adminId);
    const requestHash = toRequestHash({
      channelId,
      name: body.name,
      description: body.description ?? null,
      sortOrder: body.sortOrder ?? null,
      expectedVersion: body.expectedVersion
    });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminSiteContentChannelSummary>(tx, body.operationId, "admin-site-content-channel:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-site-content-channel:update", adminId, requestHash);

      const current = await tx.siteContentChannel.findUnique({ where: { id: channelId } });
      if (!current) throw new NotFoundException("栏目不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("栏目已被更新，请刷新后重试");

      const updated = await tx.siteContentChannel.update({
        where: { id: channelId },
        data: {
          name: body.name.trim(),
          description: body.description?.trim() || null,
          sortOrder: body.sortOrder ?? current.sortOrder,
          version: { increment: 1 }
        }
      });
      const result = this.toChannelSummary(updated);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-site-content-channel:update", adminId, requestHash, result);
      return result;
    });
  }

  async listPages(adminId: UUID): Promise<AdminSitePageSummary[]> {
    await this.requireSuperAdmin(adminId);
    await this.ensureDefaultPages();
    const rows = await this.prisma.siteContent.findMany({
      where: {
        type: "PAGE",
        slug: { in: fixedPageSeeds.map(item => item.slug) }
      },
      include: {
        channel: true,
        updatedByAdmin: true
      }
    });
    const rowMap = new Map(rows.map(item => [item.slug, item]));
    return fixedPageSeeds.map(seed => this.toPageSummary(seed.slug, rowMap.get(seed.slug)!));
  }

  async listArticles(
    page: number,
    pageSize: number,
    adminId: UUID,
    filters: { channelId?: UUID; status?: SiteContentStatus; keyword?: string }
  ): Promise<PageResult<AdminSiteContentSummary>> {
    await this.requireSuperAdmin(adminId);
    await this.ensureDefaultChannels();
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(100, toPositiveInt(pageSize, 20));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const keyword = filters.keyword?.trim();
    const where: Prisma.SiteContentWhereInput = {
      type: "ARTICLE",
      ...(filters.channelId ? { channelId: filters.channelId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" } },
              { summary: { contains: keyword, mode: "insensitive" } },
              { keywords: { contains: keyword, mode: "insensitive" } },
              { slug: { contains: keyword, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.siteContent.findMany({
        where,
        include: {
          channel: true,
          updatedByAdmin: true
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.siteContent.count({ where })
    ]);

    return {
      items: items.map(item => this.toContentSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getDetail(contentId: UUID, adminId: UUID): Promise<AdminSiteContentDetail> {
    await this.requireSuperAdmin(adminId);
    await this.ensureDefaultPages();
    const row = await this.prisma.siteContent.findUnique({
      where: { id: contentId },
      include: {
        channel: true,
        updatedByAdmin: true
      }
    });
    if (!row) throw new NotFoundException("内容不存在");
    return this.toContentDetail(row);
  }

  async createContent(body: CreateAdminSiteContentRequest, adminId: UUID): Promise<AdminSiteContentDetail> {
    await this.requireSuperAdmin(adminId);

    return this.prisma.$transaction(async tx => {
      await this.ensureDefaultPages(tx);
      const input = await this.normalizeContentInput(body, tx);
      const requestHash = toRequestHash(input);
      const repeated = await getAdminIdempotentResult<AdminSiteContentDetail>(tx, body.operationId, "admin-site-content:create", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-site-content:create", adminId, requestHash);

      const created = await tx.siteContent.create({
        data: {
          type: input.type,
          status: "DRAFT",
          channelId: input.channelId,
          slug: input.slug,
          path: input.path,
          title: input.title,
          summary: input.summary,
          keywords: input.keywords,
          label: input.label,
          heroNote: input.heroNote,
          coverImageUrl: input.coverImageUrl,
          bodyHtml: input.bodyHtml,
          bodyText: input.bodyText,
          effectiveAt: input.effectiveAt,
          sortOrder: input.sortOrder,
          updatedByAdminId: adminId
        },
        include: {
          channel: true,
          updatedByAdmin: true
        }
      });
      const result = this.toContentDetail(created);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-site-content:create", adminId, requestHash, result);
      return result;
    });
  }

  async updateContent(contentId: UUID, body: UpdateAdminSiteContentRequest, adminId: UUID): Promise<AdminSiteContentDetail> {
    await this.requireSuperAdmin(adminId);

    return this.prisma.$transaction(async tx => {
      await this.ensureDefaultPages(tx);
      const input = await this.normalizeContentInput(body, tx);
      const requestHash = toRequestHash({ contentId, input, expectedVersion: body.expectedVersion });
      const repeated = await getAdminIdempotentResult<AdminSiteContentDetail>(tx, body.operationId, "admin-site-content:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-site-content:update", adminId, requestHash);

      const current = await tx.siteContent.findUnique({ where: { id: contentId } });
      if (!current) throw new NotFoundException("内容不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("内容已被更新，请刷新后重试");

      const updated = await tx.siteContent.update({
        where: { id: contentId },
        data: {
          channelId: input.channelId,
          slug: input.slug,
          path: input.path,
          title: input.title,
          summary: input.summary,
          keywords: input.keywords,
          label: input.label,
          heroNote: input.heroNote,
          coverImageUrl: input.coverImageUrl,
          bodyHtml: input.bodyHtml,
          bodyText: input.bodyText,
          effectiveAt: input.effectiveAt,
          sortOrder: input.sortOrder,
          updatedByAdminId: adminId,
          version: { increment: 1 }
        },
        include: {
          channel: true,
          updatedByAdmin: true
        }
      });
      const result = this.toContentDetail(updated);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-site-content:update", adminId, requestHash, result);
      return result;
    });
  }

  async setStatus(contentId: UUID, body: UpdateAdminSiteContentStatusRequest, adminId: UUID): Promise<AdminSiteContentDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = toRequestHash({ contentId, status: body.status, expectedVersion: body.expectedVersion });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminSiteContentDetail>(tx, body.operationId, "admin-site-content:status", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-site-content:status", adminId, requestHash);

      const current = await tx.siteContent.findUnique({
        where: { id: contentId },
        include: {
          channel: true,
          updatedByAdmin: true
        }
      });
      if (!current) throw new NotFoundException("内容不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("内容已被更新，请刷新后重试");
      if (body.status === "PUBLISHED" && current.type === "ARTICLE") {
        if (!current.channel) throw new BadRequestException("文章发布前必须选择栏目");
        if (current.channel.code !== officialMessageChannelCode && !isPublicArticleChannelCode(current.channel.code)) {
          throw new BadRequestException("文章栏目不支持发布");
        }
      }

      const updated = await tx.siteContent.update({
        where: { id: contentId },
        data: {
          status: body.status,
          publishedAt: body.status === "PUBLISHED" ? current.publishedAt ?? new Date() : body.status === "DRAFT" ? null : current.publishedAt,
          updatedByAdminId: adminId,
          version: { increment: 1 }
        },
        include: {
          channel: true,
          updatedByAdmin: true
        }
      });
      const result = this.toContentDetail(updated);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-site-content:status", adminId, requestHash, result);
      return result;
    });
  }

  async deleteContent(contentId: UUID, operationId: string, expectedVersion: number, adminId: UUID): Promise<AdminSiteContentDeleteResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = toRequestHash({ contentId, expectedVersion });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminSiteContentDeleteResult>(
        tx,
        operationId,
        "admin-site-content:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-site-content:delete", adminId, requestHash);

      const current = await tx.siteContent.findUnique({
        where: { id: contentId }
      });
      if (!current) throw new NotFoundException("内容不存在");
      if (current.version !== expectedVersion) throw new ConflictException("内容已被更新，请刷新后重试");
      if (current.type === "PAGE") throw new BadRequestException("官网固定页不能删除");
      if (current.status === "PUBLISHED") throw new BadRequestException("已发布内容需先下架再删除");

      await tx.siteContent.delete({
        where: { id: contentId }
      });
      const result: AdminSiteContentDeleteResult = {
        contentId,
        deletedAt: new Date().toISOString()
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "SITE_CONTENT_DELETED",
          objectType: "SITE_CONTENT",
          objectId: contentId,
          payload: {
            type: current.type,
            status: current.status,
            title: current.title,
            slug: current.slug,
            path: current.path
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-site-content:delete", adminId, requestHash, result);
      return result;
    });
  }

  async resolvePublicContent(path: string): Promise<SiteContentDetail> {
    await this.ensureDefaultPages();
    const normalizedPath = this.normalizePath(path);
    const row = await this.prisma.siteContent.findFirst({
      where: {
        path: normalizedPath,
        status: "PUBLISHED"
      },
      include: {
        channel: true
      }
    });
    if (!row) throw new NotFoundException("内容不存在");
    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      path: row.path,
      title: row.title,
      summary: row.summary,
      label: row.label,
      heroNote: row.heroNote,
      coverImageUrl: row.coverImageUrl,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      publishedAt: toIsoDate(row.publishedAt),
      effectiveAt: toIsoDate(row.effectiveAt),
      updatedAt: row.updatedAt.toISOString(),
      channelCode: row.channel?.code ?? null,
      channelName: row.channel?.name ?? null
    };
  }

  async listPublicArticles(userId: number | null, page: number, pageSize: number, channelCode: string): Promise<SiteContentArticleList> {
    if (userId !== null) {
      await this.requireUser(userId);
    }
    await this.ensureDefaultChannels();
    if (!isPublicArticleChannelCode(channelCode)) {
      throw new BadRequestException("文章栏目不支持");
    }

    const channel = await this.prisma.siteContentChannel.findUnique({
      where: { code: channelCode },
      select: { id: true, code: true, name: true, description: true }
    });
    if (!channel || !isPublicArticleChannelCode(channel.code)) {
      throw new BadRequestException("文章栏目不支持");
    }

    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(50, toPositiveInt(pageSize, 20));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.SiteContentWhereInput = {
      type: "ARTICLE",
      status: "PUBLISHED",
      channelId: channel.id
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.siteContent.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.siteContent.count({ where })
    ]);

    return {
      items: items.map(item => this.toPublicArticleSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total,
      channel: {
        code: channel.code,
        name: channel.name,
        description: channel.description ?? ""
      }
    };
  }

  async getPublicArticleDetail(userId: number | null, articleId: number): Promise<SiteContentArticleDetail> {
    if (userId !== null) {
      await this.requireUser(userId);
    }
    await this.ensureDefaultChannels();
    const row = await this.findPublicArticle(userId, articleId);
    return this.toPublicArticleDetail(row);
  }

  async listOfficialMessages(userId: number, page: number, pageSize: number): Promise<PageResult<SiteContentDetail>> {
    await this.requireUser(userId);
    await this.ensureDefaultChannels();

    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(50, toPositiveInt(pageSize, 20));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.SiteContentWhereInput = {
      type: "ARTICLE",
      status: "PUBLISHED",
      channel: {
        code: officialMessageChannelCode
      }
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.siteContent.findMany({
        where,
        include: { channel: true },
        orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.siteContent.count({ where })
    ]);

    return {
      items: items.map(item => this.toSiteContentDetail(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getOfficialMessageDetail(userId: number, contentId: number): Promise<SiteContentDetail> {
    await this.requireUser(userId);
    await this.ensureDefaultChannels();

    const row = await this.prisma.siteContent.findFirst({
      where: {
        id: contentId,
        type: "ARTICLE",
        status: "PUBLISHED",
        channel: {
          code: officialMessageChannelCode
        }
      },
      include: {
        channel: true
      }
    });
    if (!row) {
      throw new NotFoundException("官方消息不存在");
    }
    return this.toSiteContentDetail(row);
  }

  async recordPublicArticleView(userId: number, articleId: number, operationId: string): Promise<SiteContentArticleViewResult> {
    await this.requireUser(userId);
    const requestHash = toRequestHash({ articleId });

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<SiteContentArticleViewResult>(tx, operationId, "site-content-article:view", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "site-content-article:view", userId, null, requestHash);

      await this.requirePublicArticleForWrite(tx, articleId);
      const updated = await tx.siteContent.update({
        where: { id: articleId },
        data: {
          viewCount: { increment: 1 }
        },
        select: {
          id: true,
          viewCount: true
        }
      });
      const result: SiteContentArticleViewResult = {
        articleId: updated.id,
        viewCount: updated.viewCount
      };
      await completeIdempotentOperation(tx, operationId, "site-content-article:view", userId, null, requestHash, result);
      return result;
    });
  }

  async likePublicArticle(userId: number, articleId: number, operationId: string): Promise<SiteContentArticleLikeResult> {
    await this.requireUser(userId);
    const requestHash = toRequestHash({ articleId, action: "like" });

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<SiteContentArticleLikeResult>(tx, operationId, "site-content-article:like", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "site-content-article:like", userId, null, requestHash);

      await this.requirePublicArticleForWrite(tx, articleId);
      const created = await tx.siteContentLike.createMany({
        data: [
          {
            contentId: articleId,
            userId
          }
        ],
        skipDuplicates: true
      });

      let likeCount: number;
      if (created.count > 0) {
        const article = await tx.siteContent.update({
          where: { id: articleId },
          data: {
            likeCount: { increment: 1 }
          },
          select: { likeCount: true }
        });
        likeCount = article.likeCount;
      } else {
        const article = await tx.siteContent.findUniqueOrThrow({
          where: { id: articleId },
          select: { likeCount: true }
        });
        likeCount = article.likeCount;
      }

      const result: SiteContentArticleLikeResult = {
        articleId,
        likeCount,
        viewerHasLiked: true
      };
      await completeIdempotentOperation(tx, operationId, "site-content-article:like", userId, null, requestHash, result);
      return result;
    });
  }

  async unlikePublicArticle(userId: number, articleId: number, operationId: string): Promise<SiteContentArticleLikeResult> {
    await this.requireUser(userId);
    const requestHash = toRequestHash({ articleId, action: "unlike" });

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<SiteContentArticleLikeResult>(tx, operationId, "site-content-article:unlike", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "site-content-article:unlike", userId, null, requestHash);

      await this.requirePublicArticleForWrite(tx, articleId);
      const deleted = await tx.siteContentLike.deleteMany({
        where: {
          contentId: articleId,
          userId
        }
      });

      let likeCount: number;
      if (deleted.count > 0) {
        const article = await tx.siteContent.update({
          where: { id: articleId },
          data: {
            likeCount: { decrement: 1 }
          },
          select: { likeCount: true }
        });
        likeCount = article.likeCount;
      } else {
        const article = await tx.siteContent.findUniqueOrThrow({
          where: { id: articleId },
          select: { likeCount: true }
        });
        likeCount = article.likeCount;
      }

      const result: SiteContentArticleLikeResult = {
        articleId,
        likeCount,
        viewerHasLiked: false
      };
      await completeIdempotentOperation(tx, operationId, "site-content-article:unlike", userId, null, requestHash, result);
      return result;
    });
  }

  private async normalizeContentInput(body: CreateAdminSiteContentRequest | UpdateAdminSiteContentRequest, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const type = body.type;
    const slug = normalizeSlug(body.slug);
    if (!slug) throw new BadRequestException("slug 不合法");

    const cleanHtml = sanitizeContentHtml(body.bodyHtml);
    const cleanText = body.bodyText.trim() || buildTextFromHtml(cleanHtml);
    if (!cleanText) throw new BadRequestException("正文不能为空");

    if (type === "PAGE") {
      const fixedPage = fixedPageSeeds.find(item => item.slug === slug);
      if (!fixedPage) throw new BadRequestException("固定页 slug 不在允许列表");
      const channels = await this.ensureDefaultChannels(tx);
      return {
        type,
        channelId: channels.get(fixedPage.channelCode)?.id ?? null,
        slug,
        path: fixedPage.path,
        title: body.title.trim(),
        summary: body.summary.trim(),
        keywords: null,
        label: body.label.trim(),
        heroNote: body.heroNote?.trim() || null,
        coverImageUrl: body.coverImageUrl?.trim() || null,
        bodyHtml: cleanHtml,
        bodyText: cleanText,
        effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : null,
        sortOrder: body.sortOrder ?? fixedPage.sortOrder
      };
    }

    if (!body.channelId) throw new BadRequestException("文章必须选择栏目");
    return {
      type,
      channelId: body.channelId,
      slug,
      path: `/guides/${slug}`,
      title: body.title.trim(),
      summary: body.summary.trim(),
      keywords: normalizeKeywords(body.keywords),
      label: body.label.trim(),
      heroNote: body.heroNote?.trim() || null,
      coverImageUrl: body.coverImageUrl?.trim() || null,
      bodyHtml: cleanHtml,
      bodyText: cleanText,
      effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : null,
      sortOrder: body.sortOrder ?? 0
    };
  }

  private async ensureDefaultChannels(tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    await tx.siteContentChannel.createMany({
      data: defaultChannelSeeds.map(item => ({
        code: item.code,
        name: item.name,
        description: item.description,
        sortOrder: item.sortOrder
      })),
      skipDuplicates: true
    });

    const rows = await tx.siteContentChannel.findMany({
      where: {
        code: { in: defaultChannelSeeds.map(item => item.code) }
      }
    });
    return new Map(rows.map(item => [item.code, item]));
  }

  private async ensureDefaultPages(tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const channels = await this.ensureDefaultChannels(tx);

    await tx.siteContent.createMany({
      data: fixedPageSeeds.map(item => ({
        type: "PAGE",
        status: "DRAFT",
        channelId: channels.get(item.channelCode)?.id ?? null,
        slug: item.slug,
        path: item.path,
        title: item.title,
        summary: "",
        keywords: null,
        label: item.label,
        heroNote: null,
        coverImageUrl: null,
        bodyHtml: "",
        bodyText: "",
        effectiveAt: null,
        sortOrder: item.sortOrder
      })),
      skipDuplicates: true
    });

    for (const item of fixedPageSeeds) {
      await tx.siteContent.updateMany({
        where: { slug: item.slug },
        data: {
          type: "PAGE",
          path: item.path,
          channelId: channels.get(item.channelCode)?.id ?? null,
          sortOrder: item.sortOrder
        }
      });
    }
  }

  private async nextChannelSortOrder(tx: Prisma.TransactionClient) {
    const current = await tx.siteContentChannel.aggregate({ _max: { sortOrder: true } });
    return (current._max.sortOrder ?? -1) + 1;
  }

  private normalizePath(path: string) {
    const text = path.trim();
    if (!text.startsWith("/")) {
      throw new BadRequestException("path 必须以 / 开头");
    }
    return text.replace(/\/{2,}/g, "/");
  }

  private toChannelSummary(row: ChannelRow): AdminSiteContentChannelSummary {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toContentSummary(row: ContentRow): AdminSiteContentSummary {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      channel: row.channel ? this.toChannelSummary(row.channel) : null,
      slug: row.slug,
      path: row.path,
      title: row.title,
      summary: row.summary,
      keywords: row.keywords,
      label: row.label,
      heroNote: row.heroNote,
      coverImageUrl: row.coverImageUrl,
      publishedAt: toIsoDate(row.publishedAt),
      effectiveAt: toIsoDate(row.effectiveAt),
      sortOrder: row.sortOrder,
      version: row.version,
      updatedBy: row.updatedByAdmin
        ? {
            id: row.updatedByAdmin.id,
            username: row.updatedByAdmin.username,
            displayName: row.updatedByAdmin.displayName
          }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toContentDetail(row: ContentRow): AdminSiteContentDetail {
    return {
      ...this.toContentSummary(row),
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText
    };
  }

  private toPageSummary(fixedSlug: string, row: ContentRow): AdminSitePageSummary {
    return {
      ...this.toContentSummary(row),
      exists: true,
      fixedSlug
    };
  }

  private async requireSuperAdmin(adminId: UUID) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: { status: true, roles: true }
    });
    if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("无权执行该操作");
    }
  }

  private toPublicArticleSummary(row: Pick<ContentRow, "id" | "title" | "summary" | "keywords" | "coverImageUrl" | "publishedAt" | "updatedAt" | "viewCount" | "likeCount">): SiteContentArticleSummary {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      keywords: row.keywords,
      coverImageUrl: row.coverImageUrl,
      publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
      viewCount: row.viewCount,
      likeCount: row.likeCount
    };
  }

  private toSiteContentDetail(
    row: Pick<ContentRow, "id" | "type" | "slug" | "path" | "title" | "summary" | "label" | "heroNote" | "coverImageUrl" | "bodyHtml" | "bodyText" | "publishedAt" | "effectiveAt" | "updatedAt"> & {
      channel?: Pick<ChannelRow, "code" | "name"> | null;
    }
  ): SiteContentDetail {
    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      path: row.path,
      title: row.title,
      summary: row.summary,
      label: row.label,
      heroNote: row.heroNote,
      coverImageUrl: row.coverImageUrl,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      publishedAt: toIsoDate(row.publishedAt),
      effectiveAt: toIsoDate(row.effectiveAt),
      updatedAt: row.updatedAt.toISOString(),
      channelCode: row.channel?.code ?? null,
      channelName: row.channel?.name ?? null
    };
  }

  private toPublicArticleDetail(
    row: Prisma.SiteContentGetPayload<{
      include: {
        channel: true;
        likes: {
          select: {
            id: true;
          };
        };
      };
    }>
  ): SiteContentArticleDetail {
    if (!row.channel || !isPublicArticleChannelCode(row.channel.code)) {
      throw new NotFoundException("文章不存在");
    }

    return {
      ...this.toPublicArticleSummary(row),
      slug: row.slug,
      path: row.path,
      label: row.label,
      heroNote: row.heroNote,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      updatedAt: row.updatedAt.toISOString(),
      channelCode: row.channel.code,
      channelName: row.channel.name,
      viewerHasLiked: row.likes.length > 0
    };
  }

  private async findPublicArticle(userId: number | null, articleId: number) {
    const row = await this.prisma.siteContent.findFirst({
      where: {
        id: articleId,
        type: "ARTICLE",
        status: "PUBLISHED",
        channel: {
          code: {
            in: publicArticleChannels.map(item => item.code)
          }
        }
      },
      include: {
        channel: true,
        likes: {
          where: userId === null ? { id: -1 } : { userId },
          select: { id: true }
        }
      }
    });

    if (!row) {
      throw new NotFoundException("文章不存在");
    }

    return row;
  }

  private async requirePublicArticleForWrite(tx: Prisma.TransactionClient, articleId: number) {
    const row = await tx.siteContent.findFirst({
      where: {
        id: articleId,
        type: "ARTICLE",
        status: "PUBLISHED",
        channel: {
          code: {
            in: publicArticleChannels.map(item => item.code)
          }
        }
      },
      select: { id: true }
    });

    if (!row) {
      throw new NotFoundException("文章不存在");
    }
  }

  private async requireUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true }
    });
    if (!user || user.status !== "ACTIVE") {
      throw new ForbiddenException("无权访问该内容");
    }
  }
}
