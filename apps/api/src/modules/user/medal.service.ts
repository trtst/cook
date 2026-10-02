import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type MedalAwardRule, type MedalTemplate } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import {
  completeAdminIdempotentOperation,
  getAdminIdempotentResult,
  startAdminIdempotentOperation
} from "../../common/idempotency";
import type {
  AdminMedalTemplateSummary,
  AdminMedalTemplateImportResult,
  AdminMedalTemplateTransferPackage,
  AdminMedalTemplateTransferPreview,
  CreateAdminMedalTemplateRequest,
  MedalCategory,
  MedalCategorySummary,
  MedalTemplateStatus,
  MedalTemplateTransferItem,
  MedalWallResponse,
  PageResult,
  SetAdminMedalTemplateStatusRequest,
  SetAdminMedalTemplateImageUrlRequest,
  UpdateAdminMedalTemplateRequest,
  UUID
} from "../../contracts/types";
import { MedalImageService, type MedalImageType } from "./medal-image.service";

type MedalDb = Prisma.TransactionClient | PrismaService;
type AssetRequest = { protocol?: string; get?: (name: string) => string | undefined };

const orderedCategories: MedalCategory[] = [
  "MEAL_CHECKIN",
  "DINING_COLLABORATION",
  "RECOMMENDATION_CONTRIBUTION",
  "HOLIDAY_LIMITED"
];

const categoryNameMap: Record<MedalCategory, string> = {
  MEAL_CHECKIN: "厨房日常",
  DINING_COLLABORATION: "饭局相聚",
  RECOMMENDATION_CONTRIBUTION: "好味分享",
  HOLIDAY_LIMITED: "节日限定"
};

const visibleHistoryStatuses = ["LISTED", "UNLISTED", "ARCHIVED"] as const;
const awardRuleIconKeyMap: Record<MedalAwardRule, string> = {
  MEAL_COMPLETION: "PLAN",
  DINING_EVENT_COMPLETION: "DINING_EVENT",
  GROUP_MEAL_COMPLETION: "GROUP",
  FULL_LOOP_COMPLETION: "SHOPPING",
  SHOPPING_COMPLETION: "SHOPPING",
  FRIDGE_MAINTENANCE: "SHOPPING",
  MEMORY_SHARE_STARTED_TOTAL: "DINING_EVENT",
  RECOMMENDATION_ADOPTED_TOTAL: "RECOMMEND"
};
const transferVersion = "cook.medal-templates.v1" as const;
const transferFields = ["code", "awardRule", "category", "name", "description", "condition", "status", "targetCount", "sortOrder", "isLimited", "startAt", "endAt"];

function transferEnvironmentLabel(): "TEST" | "ONLINE" | "UNKNOWN" {
  const value = process.env.SYSTEM_DATA_ENVIRONMENT?.trim().toUpperCase();
  return value === "TEST" || value === "ONLINE" ? value : "UNKNOWN";
}

function validTransferDate(value: unknown) {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const zoneHour = parts[7] === undefined ? null : Number(parts[7]);
  const zoneMinute = parts[8] === undefined ? null : Number(parts[8]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() + 1 === month && calendar.getUTCDate() === day &&
    hour < 24 && minute < 60 && second < 60 && (zoneHour === null || zoneHour <= 14) && (zoneMinute === null || zoneMinute < 60) && !Number.isNaN(Date.parse(value));
}

function transferPackage(input: unknown): { data: AdminMedalTemplateTransferPackage | null; conflicts: string[] } {
  const conflicts: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { data: null, conflicts: ["数据包必须是 JSON 对象"] };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !["schemaVersion", "sourceEnvironment", "exportedAt", "templates"].includes(key))) conflicts.push("数据包包含未允许的字段");
  if (value.schemaVersion !== transferVersion) conflicts.push("数据包版本错误");
  if (!validTransferDate(value.exportedAt) || value.exportedAt === null) conflicts.push("导出时间格式错误");
  if (!Array.isArray(value.templates) || value.templates.length < 1 || value.templates.length > 500) {
    conflicts.push("模板数量必须为 1 至 500 条");
    return { data: null, conflicts };
  }
  const sourceEnvironment = value.sourceEnvironment === "TEST" || value.sourceEnvironment === "ONLINE" ? value.sourceEnvironment : "UNKNOWN";
  const codes = new Set<string>();
  for (const [index, row] of value.templates.entries()) {
    const label = `第 ${index + 1} 条模板`;
    if (!row || typeof row !== "object" || Array.isArray(row)) { conflicts.push(`${label}格式错误`); continue; }
    const item = row as Record<string, unknown>;
    if (Object.keys(item).some(key => !transferFields.includes(key)) || transferFields.some(key => !Object.hasOwn(item, key))) conflicts.push(`${label}字段错误`);
    if (typeof item.code !== "string" || !/^[A-Z0-9_]{1,64}$/.test(item.code)) conflicts.push(`${label}编码错误`);
    else if (codes.has(item.code)) conflicts.push(`模板编码 ${item.code} 重复`);
    else codes.add(item.code);
    if (typeof item.awardRule !== "string" || !Object.hasOwn(awardRuleIconKeyMap, item.awardRule)) conflicts.push(`${label}发放规则错误`);
    if (typeof item.category !== "string" || !orderedCategories.includes(item.category as MedalCategory)) conflicts.push(`${label}分类错误`);
    for (const [key, limit] of [["name", 64], ["description", 255], ["condition", 255]] as const) {
      if (typeof item[key] !== "string" || !item[key].trim() || item[key].length > limit || item[key] !== item[key].trim()) conflicts.push(`${label}${key}错误`);
    }
    if (item.status !== "LISTED") conflicts.push(`${label}必须为 LISTED`);
    if (typeof item.targetCount !== "number" || !Number.isSafeInteger(item.targetCount) || item.targetCount < 1) conflicts.push(`${label}阈值错误`);
    if (typeof item.sortOrder !== "number" || !Number.isSafeInteger(item.sortOrder) || item.sortOrder < 0) conflicts.push(`${label}排序值错误`);
    if (typeof item.isLimited !== "boolean") conflicts.push(`${label}限时标记错误`);
    if (!validTransferDate(item.startAt) || !validTransferDate(item.endAt)) conflicts.push(`${label}活动时间格式错误`);
    if (item.isLimited === false && (item.startAt !== null || item.endAt !== null)) conflicts.push(`${label}非限时模板不能设置活动时间`);
    if (typeof item.startAt === "string" && typeof item.endAt === "string" && Date.parse(item.startAt) >= Date.parse(item.endAt)) conflicts.push(`${label}活动时间范围错误`);
  }
  return {
    data: conflicts.length ? null : { ...value, sourceEnvironment } as unknown as AdminMedalTemplateTransferPackage,
    conflicts
  };
}

function toIsoDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toPositiveInt(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function generateTemplateCode() {
  return normalizeCode(`MEDAL_${randomUUID().replace(/-/g, "")}`);
}

function parseOptionalDateTime(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("勋章活动时间格式错误");
  }
  return parsed;
}

function parseTemplateFields<T extends {
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  targetCount?: number;
  sortOrder?: number;
  isLimited: boolean;
  startAt: string | null;
  endAt: string | null;
}>(body: T) {
  const name = body.name.trim();
  const description = body.description.trim();
  const condition = body.condition.trim();
  const targetCount = toPositiveInt(body.targetCount, 1);
  const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0 ? body.sortOrder : 0;
  if (!name) throw new BadRequestException("勋章名称不能为空");
  if (!description) throw new BadRequestException("勋章简介不能为空");
  if (!condition) throw new BadRequestException("勋章获取条件不能为空");

  const startAt = body.isLimited ? parseOptionalDateTime(body.startAt) : null;
  const endAt = body.isLimited ? parseOptionalDateTime(body.endAt) : null;
  if (startAt && endAt && startAt >= endAt) {
    throw new BadRequestException("勋章活动时间范围错误");
  }

  return {
    category: body.category,
    name,
    description,
    condition,
    targetCount,
    sortOrder,
    isLimited: body.isLimited,
    startAt,
    endAt
  };
}

function getTemplateImageUpdate(imageType: MedalImageType, updatedAt: Date | null): Pick<MedalTemplate, never> & {
  earnedImageUpdatedAt?: Date | null;
  lockedImageUpdatedAt?: Date | null;
} {
  return imageType === "earned" ? { earnedImageUpdatedAt: updatedAt } : { lockedImageUpdatedAt: updatedAt };
}

function getTemplateImageSourceUpdate(imageType: MedalImageType, sourceUrl: string | null) {
  return imageType === "earned" ? { earnedImageSourceUrl: sourceUrl } : { lockedImageSourceUrl: sourceUrl };
}

function toAdminTemplateSummary(
  template: MedalTemplate,
  request: AssetRequest,
  medalImageService: MedalImageService
): AdminMedalTemplateSummary {
  return {
    id: template.id,
    code: template.code,
    awardRule: template.awardRule,
    category: template.category,
    categoryName: categoryNameMap[template.category],
    name: template.name,
    description: template.description,
    condition: template.condition,
    iconKey: template.iconKey,
    imageUrl: medalImageService.buildImageUrl(request, template.id, "earned", template.earnedImageUpdatedAt, template.earnedImageSourceUrl),
    earnedImageUrl: medalImageService.buildImageUrl(request, template.id, "earned", template.earnedImageUpdatedAt, template.earnedImageSourceUrl),
    lockedImageUrl: medalImageService.buildImageUrl(request, template.id, "locked", template.lockedImageUpdatedAt, template.lockedImageSourceUrl),
    status: template.status,
    targetCount: template.targetCount,
    sortOrder: template.sortOrder,
    isLimited: template.isLimited,
    startAt: toIsoDate(template.startAt),
    endAt: toIsoDate(template.endAt),
    version: template.version,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  };
}

@Injectable()
export class MedalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MedalImageService) private readonly medalImageService: MedalImageService
  ) {}

  async getCurrent(request: AssetRequest, userId: UUID): Promise<MedalWallResponse> {
    const medals = await this.prisma.userMedal.findMany({
      where: { userId },
      orderBy: [{ awardedAt: "asc" }, { id: "asc" }]
    });
    const earnedMap = new Map(medals.map(item => [item.code, item]));
    const earnedCodes = medals.map(item => item.code);

    const templates = await this.prisma.medalTemplate.findMany({
      where: {
        OR: [
          { status: "LISTED" },
          ...(earnedCodes.length
            ? [
                {
                  code: { in: earnedCodes },
                  status: { in: [...visibleHistoryStatuses] }
                }
              ]
            : [])
        ]
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    });
    const countRows = templates.length
      ? await this.prisma.userMedal.groupBy({
          by: ["code"],
          where: {
            code: {
              in: templates.map(item => item.code)
            }
          },
          _count: {
            _all: true
          }
        })
      : [];
    const earnedUserCountMap = new Map(countRows.map(item => [item.code, item._count._all]));

    const items = templates.map(template => {
      const earned = earnedMap.get(template.code) ?? null;
      return {
        code: template.code,
        awardRule: template.awardRule,
        iconKey: template.iconKey,
        imageUrl: this.medalImageService.buildImageUrl(request, template.id, "earned", template.earnedImageUpdatedAt, template.earnedImageSourceUrl),
        earnedImageUrl: this.medalImageService.buildImageUrl(request, template.id, "earned", template.earnedImageUpdatedAt, template.earnedImageSourceUrl),
        lockedImageUrl: this.medalImageService.buildImageUrl(request, template.id, "locked", template.lockedImageUpdatedAt, template.lockedImageSourceUrl),
        category: template.category,
        categoryName: categoryNameMap[template.category],
        name: template.name,
        description: template.description,
        condition: template.condition,
        earnedUserCount: earnedUserCountMap.get(template.code) ?? 0,
        earned: Boolean(earned),
        isLimited: template.isLimited,
        startAt: toIsoDate(template.startAt),
        endAt: toIsoDate(template.endAt),
        awardedAt: earned ? earned.awardedAt.toISOString() : null
      };
    });

    const categories = orderedCategories
      .map<MedalCategorySummary>(key => {
        const group = items.filter(item => item.category === key);
        return {
          key,
          name: categoryNameMap[key],
          totalCount: group.length,
          earnedCount: group.filter(item => item.earned).length
        };
      })
      .filter(item => item.totalCount > 0);

    return {
      earnedCount: items.filter(item => item.earned).length,
      totalCount: items.length,
      categories,
      items
    };
  }

  async listTemplates(
    request: AssetRequest,
    page: number,
    pageSize: number,
    keyword: string | undefined,
    status: MedalTemplateStatus | undefined,
    category: MedalCategory | undefined
  ): Promise<PageResult<AdminMedalTemplateSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const normalizedKeyword = keyword?.trim();
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.MedalTemplateWhereInput = {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(normalizedKeyword
        ? {
            OR: [
              { code: { contains: normalizedKeyword, mode: "insensitive" } },
              { name: { contains: normalizedKeyword, mode: "insensitive" } },
              { description: { contains: normalizedKeyword, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.medalTemplate.findMany({
        where,
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.medalTemplate.count({ where })
    ]);

    return {
      items: items.map(item => toAdminTemplateSummary(item, request, this.medalImageService)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async exportTemplates(templateIds: number[]): Promise<AdminMedalTemplateTransferPackage> {
    if (!Array.isArray(templateIds) || templateIds.length < 1 || templateIds.length > 500 || new Set(templateIds).size !== templateIds.length || templateIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
      throw new BadRequestException("请选择 1 至 500 个不同的勋章模板");
    }
    const rows = await this.prisma.medalTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, code: true, awardRule: true, category: true, name: true, description: true, condition: true, status: true, targetCount: true, sortOrder: true, isLimited: true, startAt: true, endAt: true }
    });
    if (rows.length !== templateIds.length || rows.some(row => row.status !== "LISTED")) throw new ConflictException("所选勋章模板不存在或未上架，请刷新后重试");
    const byId = new Map(rows.map(row => [row.id, row]));
    const templates: MedalTemplateTransferItem[] = templateIds.map(id => {
      const row = byId.get(id)!;
      return {
        code: row.code, awardRule: row.awardRule, category: row.category,
        name: row.name, description: row.description, condition: row.condition,
        status: "LISTED", targetCount: row.targetCount, sortOrder: row.sortOrder,
        isLimited: row.isLimited, startAt: toIsoDate(row.startAt), endAt: toIsoDate(row.endAt)
      };
    });
    return { schemaVersion: transferVersion, sourceEnvironment: transferEnvironmentLabel(), exportedAt: new Date().toISOString(), templates };
  }

  async previewTemplateImport(input: unknown): Promise<AdminMedalTemplateTransferPreview> {
    const parsed = transferPackage(input);
    const templates = parsed.data?.templates ?? [];
    const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
    const sourceEnvironment = raw?.sourceEnvironment === "TEST" || raw?.sourceEnvironment === "ONLINE" ? raw.sourceEnvironment : "UNKNOWN";
    const current = templates.length ? await this.prisma.medalTemplate.findMany({
      where: { code: { in: templates.map(item => item.code) } },
      select: { code: true, awardRule: true }
    }) : [];
    const byCode = new Map(current.map(item => [item.code, item]));
    for (const item of templates) {
      const matched = byCode.get(item.code);
      if (matched && matched.awardRule !== item.awardRule) parsed.conflicts.push(`模板编码 ${item.code} 的发放规则与当前环境不一致`);
    }
    return {
      schemaVersion: transferVersion,
      targetEnvironment: transferEnvironmentLabel(),
      sourceEnvironment,
      counts: { total: Array.isArray(raw?.templates) ? raw.templates.length : 0, new: templates.length - current.length, existing: current.length },
      conflicts: parsed.conflicts
    };
  }

  async importTemplates(input: unknown, operationId: string, adminId: UUID): Promise<AdminMedalTemplateImportResult> {
    const parsed = transferPackage(input);
    if (!parsed.data || parsed.conflicts.length) throw new BadRequestException(parsed.conflicts.join("；"));
    const data = parsed.data;
    const requestHash = JSON.stringify(data);
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminMedalTemplateImportResult>(tx, operationId, "admin-medal-template:import", adminId, requestHash);
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-medal-template:import", adminId, requestHash);
        const current = await tx.medalTemplate.findMany({ where: { code: { in: data.templates.map(item => item.code) } }, select: { code: true, awardRule: true, version: true } });
        const byCode = new Map(current.map(item => [item.code, item]));
        if (data.templates.some(item => byCode.has(item.code) && byCode.get(item.code)!.awardRule !== item.awardRule)) {
          throw new ConflictException("同编码勋章模板的发放规则不一致，整批未导入");
        }
        let createdCount = 0;
        let updatedCount = 0;
        for (const item of data.templates) {
          const fields = {
            category: item.category, name: item.name, description: item.description, condition: item.condition,
            status: "LISTED" as const, targetCount: item.targetCount, sortOrder: item.sortOrder,
            isLimited: item.isLimited, startAt: item.startAt ? new Date(item.startAt) : null,
            endAt: item.endAt ? new Date(item.endAt) : null
          };
          const matched = byCode.get(item.code);
          if (matched) {
            const updated = await tx.medalTemplate.updateMany({ where: { code: item.code, awardRule: item.awardRule, version: matched.version }, data: { ...fields, version: { increment: 1 } } });
            if (updated.count !== 1) throw new ConflictException("勋章模板已被更新，请重新预览");
            updatedCount++;
          } else {
            await tx.medalTemplate.create({ data: { ...fields, code: item.code, awardRule: item.awardRule, iconKey: awardRuleIconKeyMap[item.awardRule], earnedImageSourceUrl: null, lockedImageSourceUrl: null, earnedImageUpdatedAt: null, lockedImageUpdatedAt: null, version: 1 } });
            createdCount++;
          }
        }
        const result = { importedCount: data.templates.length, createdCount, updatedCount };
        await tx.auditEvent.create({ data: { actorType: "ADMIN", actorAdminId: adminId, action: "MEDAL_TEMPLATE_IMPORTED", objectType: "MEDAL_TEMPLATE", payload: { schemaVersion: transferVersion, sourceEnvironment: data.sourceEnvironment, targetEnvironment: transferEnvironmentLabel(), ...result } } });
        await completeAdminIdempotentOperation(tx, operationId, "admin-medal-template:import", adminId, requestHash, result);
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
    } catch (error) {
      if (isUniqueConstraintError(error) || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")) throw new ConflictException("勋章模板导入遇到并发修改，请重新预览");
      throw error;
    }
  }

  async createTemplate(request: AssetRequest, body: CreateAdminMedalTemplateRequest, adminId: UUID): Promise<AdminMedalTemplateSummary> {
    const code = generateTemplateCode();
    const fields = parseTemplateFields(body);
    const status = body.status ?? "DRAFT";
    const requestHash = JSON.stringify({
      awardRule: body.awardRule,
      status,
      ...fields
    });

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminMedalTemplateSummary>(
          tx,
          body.operationId,
          "admin-medal-template:create",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:create", adminId, requestHash);

        const created = await tx.medalTemplate.create({
          data: {
            code,
            awardRule: body.awardRule,
            category: fields.category,
            name: fields.name,
            description: fields.description,
            condition: fields.condition,
            iconKey: awardRuleIconKeyMap[body.awardRule],
            status,
            targetCount: fields.targetCount,
            sortOrder: fields.sortOrder,
            isLimited: fields.isLimited,
            startAt: fields.startAt,
            endAt: fields.endAt
          }
        });
        const result = toAdminTemplateSummary(created, request, this.medalImageService);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "MEDAL_TEMPLATE_CREATED",
            objectType: "MEDAL_TEMPLATE",
            objectId: created.id,
            payload: {
              code,
              awardRule: body.awardRule,
              status
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:create", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("勋章模板创建冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async updateTemplate(
    request: AssetRequest,
    templateId: UUID,
    body: UpdateAdminMedalTemplateRequest,
    adminId: UUID
  ): Promise<AdminMedalTemplateSummary> {
    const fields = parseTemplateFields(body);
    const requestHash = JSON.stringify({
      templateId,
      expectedVersion: body.expectedVersion,
      ...fields
    });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMedalTemplateSummary>(
        tx,
        body.operationId,
        "admin-medal-template:update",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:update", adminId, requestHash);

      const current = await this.requireTemplate(tx, templateId);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("勋章模板已被更新，请刷新后重试");
      }

      const updated = await tx.medalTemplate.update({
        where: { id: templateId },
        data: {
          category: fields.category,
          name: fields.name,
          description: fields.description,
          condition: fields.condition,
          targetCount: fields.targetCount,
          sortOrder: fields.sortOrder,
          isLimited: fields.isLimited,
          startAt: fields.startAt,
          endAt: fields.endAt,
          version: { increment: 1 }
        }
      });
      const result = toAdminTemplateSummary(updated, request, this.medalImageService);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "MEDAL_TEMPLATE_UPDATED",
          objectType: "MEDAL_TEMPLATE",
          objectId: templateId,
          payload: {
            code: current.code,
            version: updated.version
          }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:update", adminId, requestHash, result);
      return result;
    });
  }

  async setTemplateStatus(
    request: AssetRequest,
    templateId: UUID,
    body: SetAdminMedalTemplateStatusRequest,
    adminId: UUID
  ): Promise<AdminMedalTemplateSummary> {
    const requestHash = `${templateId}:${body.expectedVersion}:${body.status}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMedalTemplateSummary>(
        tx,
        body.operationId,
        "admin-medal-template:set-status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:set-status", adminId, requestHash);

      const current = await this.requireTemplate(tx, templateId);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("勋章模板已被更新，请刷新后重试");
      }

      const updated =
        current.status === body.status
          ? current
          : await tx.medalTemplate.update({
              where: { id: templateId },
              data: {
                status: body.status,
                version: { increment: 1 }
              }
            });
      const result = toAdminTemplateSummary(updated, request, this.medalImageService);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "MEDAL_TEMPLATE_STATUS_CHANGED",
          objectType: "MEDAL_TEMPLATE",
          objectId: templateId,
          payload: {
            code: current.code,
            status: body.status
          }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:set-status", adminId, requestHash, result);
      return result;
    });
  }

  async uploadTemplateImage(
    request: AssetRequest,
    templateId: UUID,
    imageType: MedalImageType,
    operationId: string,
    expectedVersion: number,
    file: { buffer?: Buffer; size?: number } | undefined,
    adminId: UUID
  ): Promise<AdminMedalTemplateSummary> {
    const fileHash = file?.buffer ? createHash("sha256").update(file.buffer).digest("hex") : "missing";
    const requestHash = `${templateId}:${imageType}:${expectedVersion}:${fileHash}`;
    const staged = await this.medalImageService.stageImageUpload(templateId, imageType, file);
    let backupImagePath: string | null = null;
    let replaced = false;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminMedalTemplateSummary>(
          tx,
          operationId,
          "admin-medal-template:upload-image",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-medal-template:upload-image", adminId, requestHash);

        const template = await this.requireTemplate(tx, templateId);
        if (template.version !== expectedVersion) {
          throw new ConflictException("勋章模板已被更新，请刷新后重试");
        }

        backupImagePath = await this.medalImageService.replaceStagedImage(templateId, imageType, staged.tempPath, staged.kind);
        replaced = true;

        const updated = await tx.medalTemplate.update({
          where: { id: templateId },
          data: {
            ...getTemplateImageUpdate(imageType, new Date()),
            ...getTemplateImageSourceUpdate(imageType, null),
            version: { increment: 1 }
          }
        });
        const result = toAdminTemplateSummary(updated, request, this.medalImageService);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "MEDAL_TEMPLATE_IMAGE_UPDATED",
            objectType: "MEDAL_TEMPLATE",
            objectId: templateId,
            payload: {
              code: template.code,
              imageType,
              fileHash
            }
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-medal-template:upload-image", adminId, requestHash, result);
        return result;
      });

      if (replaced) {
        await this.medalImageService.finalizeReplacedImage(backupImagePath);
      } else {
        await this.medalImageService.discardStagedImage(staged.tempPath);
      }
      return result;
    } catch (error) {
      if (replaced) {
        await this.medalImageService.rollbackReplacedImage(templateId, imageType, backupImagePath);
      } else {
        await this.medalImageService.discardStagedImage(staged.tempPath);
      }
      throw error;
    }
  }

  async setTemplateImageUrl(
    request: AssetRequest,
    templateId: UUID,
    imageType: MedalImageType,
    body: SetAdminMedalTemplateImageUrlRequest,
    adminId: UUID
  ): Promise<AdminMedalTemplateSummary> {
    if (imageType !== "earned" && imageType !== "locked") {
      throw new BadRequestException("勋章图片类型无效");
    }
    const imageUrl = body.imageUrl.trim();
    if (!this.medalImageService.isConfiguredPublicUrl(imageUrl)) {
      throw new BadRequestException("图片地址请使用已配置的静态资源域名，并选择 uploads 下的图片");
    }

    const requestHash = `${templateId}:${imageType}:${body.expectedVersion}:${imageUrl}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminMedalTemplateSummary>(
        tx,
        body.operationId,
        "admin-medal-template:set-image-url",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:set-image-url", adminId, requestHash);

      const template = await this.requireTemplate(tx, templateId);
      if (template.version !== body.expectedVersion) {
        throw new ConflictException("勋章模板已被更新，请刷新后重试");
      }

      const updated = await tx.medalTemplate.update({
        where: { id: templateId },
        data: {
          ...getTemplateImageSourceUpdate(imageType, imageUrl),
          version: { increment: 1 }
        }
      });
      const result = toAdminTemplateSummary(updated, request, this.medalImageService);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "MEDAL_TEMPLATE_IMAGE_URL_UPDATED",
          objectType: "MEDAL_TEMPLATE",
          objectId: templateId,
          payload: { code: template.code, imageType }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-medal-template:set-image-url", adminId, requestHash, result);
      return result;
    });
  }

  async clearTemplateImage(
    request: AssetRequest,
    templateId: UUID,
    imageType: MedalImageType,
    operationId: string,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminMedalTemplateSummary> {
    const requestHash = `${templateId}:${imageType}:${expectedVersion}:clear`;
    let backupImagePath: string | null = null;
    let cleared = false;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminMedalTemplateSummary>(
          tx,
          operationId,
          "admin-medal-template:clear-image",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-medal-template:clear-image", adminId, requestHash);

        const template = await this.requireTemplate(tx, templateId);
        if (template.version !== expectedVersion) {
          throw new ConflictException("勋章模板已被更新，请刷新后重试");
        }

        backupImagePath = await this.medalImageService.stageClearImage(templateId, imageType);
        cleared = true;

        const updated = await tx.medalTemplate.update({
          where: { id: templateId },
          data: {
            ...getTemplateImageUpdate(imageType, null),
            ...getTemplateImageSourceUpdate(imageType, null),
            version: { increment: 1 }
          }
        });
        const result = toAdminTemplateSummary(updated, request, this.medalImageService);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "MEDAL_TEMPLATE_IMAGE_CLEARED",
            objectType: "MEDAL_TEMPLATE",
            objectId: templateId,
            payload: {
              code: template.code,
              imageType
            }
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-medal-template:clear-image", adminId, requestHash, result);
        return result;
      });

      if (cleared) {
        await this.medalImageService.finalizeClearedImage(backupImagePath);
      }
      return result;
    } catch (error) {
      if (cleared) {
        await this.medalImageService.rollbackClearedImage(templateId, backupImagePath);
      }
      throw error;
    }
  }

  async awardMealCompletion(
    db: MedalDb,
    userId: UUID,
    _diningEvent: { id: UUID; status: string } | null,
    awardedAt: Date
  ) {
    await this.grantByRule(db, [userId], "MEAL_COMPLETION", awardedAt);
    await this.grantByRule(db, [userId], "FULL_LOOP_COMPLETION", awardedAt);
  }

  async awardDiningEventCompletion(db: MedalDb, ownerId: UUID, acceptedUserIds: UUID[], awardedAt: Date) {
    const participantIds = [...new Set([ownerId, ...acceptedUserIds])];
    await this.grantByRule(db, participantIds, "MEAL_COMPLETION", awardedAt);
    await this.grantByRule(db, participantIds, "DINING_EVENT_COMPLETION", awardedAt);
    if (acceptedUserIds.length > 0) {
      await this.grantByRule(db, [ownerId], "GROUP_MEAL_COMPLETION", awardedAt);
    }
    await this.grantByRule(db, [ownerId], "FULL_LOOP_COMPLETION", awardedAt);
  }

  async awardRecommendationContribution(db: MedalDb, userId: UUID, awardedAt: Date) {
    await this.grantByRule(db, [userId], "RECOMMENDATION_ADOPTED_TOTAL", awardedAt);
  }

  async awardShoppingCompletion(db: MedalDb, userId: UUID, awardedAt: Date) {
    await this.grantByRule(db, [userId], "SHOPPING_COMPLETION", awardedAt);
  }

  async awardFridgeMaintenance(db: MedalDb, userId: UUID, awardedAt: Date) {
    await this.grantByRule(db, [userId], "FRIDGE_MAINTENANCE", awardedAt);
  }

  async awardMemoryShareStarted(db: MedalDb, userId: UUID, awardedAt: Date) {
    await this.grantByRule(db, [userId], "MEMORY_SHARE_STARTED_TOTAL", awardedAt);
  }

  private async grantByRule(db: MedalDb, userIds: UUID[], rule: MedalAwardRule, awardedAt: Date) {
    const uniqueUserIds = [...new Set(userIds)];
    if (!uniqueUserIds.length) return;

    const countMap = await this.resolveRuleCounts(db, uniqueUserIds, rule);
    const maxCount = Math.max(0, ...uniqueUserIds.map(userId => countMap.get(userId) ?? 0));
    if (maxCount < 1) return;

    const templates = await db.medalTemplate.findMany({
      where: {
        awardRule: rule,
        status: "LISTED",
        targetCount: {
          lte: maxCount
        }
      },
      orderBy: [{ targetCount: "asc" }, { sortOrder: "asc" }, { id: "asc" }]
    });

    const earnableTemplates = templates.filter(template => this.canEarnTemplate(template, awardedAt));
    if (!earnableTemplates.length) return;

    const data = uniqueUserIds.flatMap(userId => {
      const count = countMap.get(userId) ?? 0;
      return earnableTemplates
        .filter(template => count >= template.targetCount)
        .map(template => ({
          userId,
          code: template.code,
          awardedAt
        }));
    });

    if (!data.length) return;

    await db.userMedal.createMany({
      data,
      skipDuplicates: true
    });
  }

  private async resolveRuleCounts(db: MedalDb, userIds: UUID[], rule: MedalAwardRule) {
    switch (rule) {
      case "MEAL_COMPLETION":
        return this.countMealCompletion(db, userIds);
      case "DINING_EVENT_COMPLETION":
        return this.countDiningEventCompletion(db, userIds);
      case "GROUP_MEAL_COMPLETION":
        return this.countGroupMealCompletion(db, userIds);
      case "FULL_LOOP_COMPLETION":
        return this.countFullLoopCompletion(db, userIds);
      case "SHOPPING_COMPLETION":
        return this.countShoppingCompletion(db, userIds);
      case "FRIDGE_MAINTENANCE":
        return this.countFridgeMaintenance(db, userIds);
      case "MEMORY_SHARE_STARTED_TOTAL":
        return this.countMemoryShareStarted(db, userIds);
      case "RECOMMENDATION_ADOPTED_TOTAL":
        return this.countRecommendationAdoptedTotal(db, userIds);
      default:
        return new Map<UUID, number>();
    }
  }

  private async countMealCompletion(db: MedalDb, userIds: UUID[]) {
    const [plans, events] = await Promise.all([
      db.mealPlanItem.findMany({
        where: { userId: { in: userIds }, status: "COMPLETED" },
        select: { userId: true, diningEvent: { select: { status: true } } }
      }),
      db.diningEvent.findMany({
        where: {
          status: "COMPLETED",
          OR: [
            { userId: { in: userIds } },
            { participants: { some: { userId: { in: userIds }, status: "ACCEPTED" } } }
          ]
        },
        select: {
          userId: true,
          participants: { where: { userId: { in: userIds }, status: "ACCEPTED" }, select: { userId: true } }
        }
      })
    ]);
    const counts = new Map<UUID, number>();
    for (const plan of plans) {
      if (plan.diningEvent?.status === "COMPLETED") continue;
      counts.set(plan.userId, (counts.get(plan.userId) ?? 0) + 1);
    }
    for (const event of events) {
      const participants = new Set([event.userId, ...event.participants.flatMap(item => item.userId ? [item.userId] : [])]);
      for (const userId of participants) counts.set(userId, (counts.get(userId) ?? 0) + 1);
    }
    return counts;
  }

  private async countDiningEventCompletion(db: MedalDb, userIds: UUID[]) {
    const events = await db.diningEvent.findMany({
      where: {
        status: "COMPLETED",
        OR: [
          { userId: { in: userIds } },
          {
            participants: {
              some: {
                userId: { in: userIds },
                status: "ACCEPTED"
              }
            }
          }
        ]
      },
      select: {
        id: true,
        userId: true,
        participants: {
          where: {
            userId: { in: userIds },
            status: "ACCEPTED"
          },
          select: {
            userId: true
          }
        }
      }
    });

    const eventMap = new Map<UUID, Set<UUID>>();
    for (const event of events) {
      const joinedUsers = eventMap.get(event.id) ?? new Set<UUID>();
      if (userIds.includes(event.userId)) {
        joinedUsers.add(event.userId);
      }
      for (const participant of event.participants) {
        if (!participant.userId) continue;
        joinedUsers.add(participant.userId);
      }
      eventMap.set(event.id, joinedUsers);
    }

    const countMap = new Map<UUID, number>();
    for (const users of eventMap.values()) {
      for (const userId of users) {
        countMap.set(userId, (countMap.get(userId) ?? 0) + 1);
      }
    }
    return countMap;
  }

  private async countGroupMealCompletion(db: MedalDb, userIds: UUID[]) {
    const events = await db.diningEvent.findMany({
      where: {
        userId: { in: userIds },
        status: "COMPLETED",
        participants: {
          some: {
            status: "ACCEPTED"
          }
        }
      },
      select: {
        userId: true
      }
    });
    const countMap = new Map<UUID, number>();
    for (const event of events) {
      countMap.set(event.userId, (countMap.get(event.userId) ?? 0) + 1);
    }
    return countMap;
  }

  private async countFullLoopCompletion(db: MedalDb, userIds: UUID[]) {
    const rows = await db.diningEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "COMPLETED", ingredientsReadyAt: { not: null } },
      _count: { _all: true }
    });
    return new Map(rows.map(row => [row.userId, row._count._all]));
  }

  private async countShoppingCompletion(db: MedalDb, userIds: UUID[]) {
    if (!userIds.length) return new Map<UUID, number>();
    const rows = await db.$queryRaw<Array<{ userId: number; count: bigint | number }>>(Prisma.sql`
      WITH qualified AS (
        SELECT list.owner_user_id AS "userId", list.id, list.completed_at AS "completedAt",
          ROW_NUMBER() OVER (
            PARTITION BY list.owner_user_id, (list.completed_at AT TIME ZONE 'Asia/Shanghai')::date
            ORDER BY list.completed_at ASC, list.id ASC
          ) AS "dayRank"
        FROM shopping_lists list
        WHERE list.owner_user_id IN (${Prisma.join(userIds)})
          AND list.status = 'COMPLETED'
          AND list.completed_at IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM shopping_items item
            WHERE item.list_id = list.id AND item.status <> 'DELETED'
          )
          AND NOT EXISTS (
            SELECT 1 FROM shopping_items item
            WHERE item.list_id = list.id AND item.status NOT IN ('BOUGHT', 'DELETED')
          )
      )
      SELECT "userId", COUNT(*)::BIGINT AS count FROM qualified
      WHERE "dayRank" <= 2 GROUP BY "userId"
    `);
    return new Map(rows.map(row => [row.userId, Number(row.count)]));
  }

  private async countFridgeMaintenance(db: MedalDb, userIds: UUID[]) {
    if (!userIds.length) return new Map<UUID, number>();
    const rows = await db.$queryRaw<Array<{ userId: number; count: bigint | number }>>(Prisma.sql`
      SELECT user_id AS "userId", COUNT(DISTINCT DATE_TRUNC('week', created_at AT TIME ZONE 'Asia/Shanghai'))::BIGINT AS count
      FROM fridge_maintenance_events
      WHERE user_id IN (${Prisma.join(userIds)})
      GROUP BY user_id
    `);
    return new Map(rows.map(row => [row.userId, Number(row.count)]));
  }

  private async countMemoryShareStarted(db: MedalDb, userIds: UUID[]) {
    const rows = await db.diningEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "COMPLETED", memoryShareStartedAt: { not: null } },
      _count: { _all: true }
    });
    return new Map(rows.map(row => [row.userId, row._count._all]));
  }

  private async countRecommendationAdoptedTotal(db: MedalDb, userIds: UUID[]) {
    const [recipeRows, ingredientRows] = await Promise.all([
      db.recipeRecommendation.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: "ADOPTED"
        },
        _count: {
          _all: true
        }
      }),
      db.ingredientRecommendation.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: {
            in: ["ADOPTED", "MERGED"]
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const countMap = new Map<UUID, number>();
    for (const row of recipeRows) {
      countMap.set(row.userId, row._count._all);
    }
    for (const row of ingredientRows) {
      countMap.set(row.userId, (countMap.get(row.userId) ?? 0) + row._count._all);
    }
    return countMap;
  }

  private canEarnTemplate(template: MedalTemplate, awardedAt: Date) {
    if (template.status !== "LISTED") return false;
    if (!template.isLimited) return true;
    if (template.startAt && template.startAt > awardedAt) return false;
    if (template.endAt && template.endAt < awardedAt) return false;
    return true;
  }

  private async requireTemplate(db: MedalDb, templateId: UUID) {
    const template = await db.medalTemplate.findUnique({
      where: { id: templateId }
    });
    if (!template) {
      throw new NotFoundException("勋章模板不存在");
    }
    return template;
  }
}
