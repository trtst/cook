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
  CreateAdminMedalTemplateRequest,
  MedalCategory,
  MedalCategorySummary,
  MedalTemplateStatus,
  MedalWallResponse,
  PageResult,
  SetAdminMedalTemplateStatusRequest,
  UpdateAdminMedalTemplateRequest,
  UUID
} from "../../contracts/types";

type MedalDb = Prisma.TransactionClient | PrismaService;

const orderedCategories: MedalCategory[] = [
  "MEAL_CHECKIN",
  "DINING_COLLABORATION",
  "RECOMMENDATION_CONTRIBUTION",
  "HOLIDAY_LIMITED"
];

const categoryNameMap: Record<MedalCategory, string> = {
  MEAL_CHECKIN: "开饭打卡",
  DINING_COLLABORATION: "饭局协作",
  RECOMMENDATION_CONTRIBUTION: "推荐贡献",
  HOLIDAY_LIMITED: "节假日限定"
};

const visibleHistoryStatuses = ["LISTED", "UNLISTED", "ARCHIVED"] as const;

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
  iconKey: string;
  targetCount?: number;
  sortOrder?: number;
  isLimited: boolean;
  startAt: string | null;
  endAt: string | null;
}>(body: T) {
  const name = body.name.trim();
  const description = body.description.trim();
  const condition = body.condition.trim();
  const iconKey = body.iconKey.trim().toUpperCase();
  const targetCount = toPositiveInt(body.targetCount, 1);
  const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0 ? body.sortOrder : 0;
  if (!name) throw new BadRequestException("勋章名称不能为空");
  if (!description) throw new BadRequestException("勋章简介不能为空");
  if (!condition) throw new BadRequestException("勋章获取条件不能为空");
  if (!iconKey) throw new BadRequestException("勋章图标标识不能为空");

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
    iconKey,
    targetCount,
    sortOrder,
    isLimited: body.isLimited,
    startAt,
    endAt
  };
}

function toAdminTemplateSummary(template: MedalTemplate): AdminMedalTemplateSummary {
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(userId: UUID): Promise<MedalWallResponse> {
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

    const items = templates.map(template => {
      const earned = earnedMap.get(template.code) ?? null;
      return {
        code: template.code,
        awardRule: template.awardRule,
        iconKey: template.iconKey,
        category: template.category,
        categoryName: categoryNameMap[template.category],
        name: template.name,
        description: template.description,
        condition: template.condition,
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
      items: items.map(toAdminTemplateSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createTemplate(body: CreateAdminMedalTemplateRequest, adminId: UUID): Promise<AdminMedalTemplateSummary> {
    const code = normalizeCode(body.code);
    const fields = parseTemplateFields(body);
    const status = body.status ?? "DRAFT";
    const requestHash = JSON.stringify({
      code,
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
            iconKey: fields.iconKey,
            status,
            targetCount: fields.targetCount,
            sortOrder: fields.sortOrder,
            isLimited: fields.isLimited,
            startAt: fields.startAt,
            endAt: fields.endAt
          }
        });
        const result = toAdminTemplateSummary(created);
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
        throw new ConflictException("勋章编码已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async updateTemplate(
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
          iconKey: fields.iconKey,
          targetCount: fields.targetCount,
          sortOrder: fields.sortOrder,
          isLimited: fields.isLimited,
          startAt: fields.startAt,
          endAt: fields.endAt,
          version: { increment: 1 }
        }
      });
      const result = toAdminTemplateSummary(updated);
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
      const result = toAdminTemplateSummary(updated);
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

  async awardMealCompletion(
    db: MedalDb,
    userId: UUID,
    diningEvent: { id: UUID; status: string } | null,
    awardedAt: Date
  ) {
    await this.grantByRule(db, [userId], "MEAL_COMPLETION", awardedAt);

    if (!diningEvent || diningEvent.status !== "COMPLETED") {
      return;
    }

    const bought = await db.shoppingItem.findFirst({
      where: {
        userId,
        sourceType: "EVENT",
        status: "BOUGHT",
        sourceKey: {
          startsWith: `${diningEvent.id}:`
        }
      },
      select: { id: true }
    });

    if (!bought) {
      return;
    }

    await this.grantByRule(db, [userId], "FULL_LOOP_COMPLETION", awardedAt);
  }

  async awardDiningEventCompletion(db: MedalDb, ownerId: UUID, acceptedUserIds: UUID[], awardedAt: Date) {
    const participantIds = [...new Set([ownerId, ...acceptedUserIds])];
    await this.grantByRule(db, participantIds, "DINING_EVENT_COMPLETION", awardedAt);
    if (acceptedUserIds.length > 0) {
      await this.grantByRule(db, [ownerId], "GROUP_MEAL_COMPLETION", awardedAt);
    }
  }

  async awardRecommendationContribution(db: MedalDb, userId: UUID, awardedAt: Date) {
    await this.grantByRule(db, [userId], "RECOMMENDATION_ADOPTED_TOTAL", awardedAt);
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
      case "RECOMMENDATION_ADOPTED_TOTAL":
        return this.countRecommendationAdoptedTotal(db, userIds);
      default:
        return new Map<UUID, number>();
    }
  }

  private async countMealCompletion(db: MedalDb, userIds: UUID[]) {
    const rows = await db.mealPlanItem.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        status: "COMPLETED"
      },
      _count: {
        _all: true
      }
    });
    return new Map(rows.map(row => [row.userId, row._count._all]));
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
    const [items, shoppingItems] = await Promise.all([
      db.mealPlanItem.findMany({
        where: {
          userId: { in: userIds },
          status: "COMPLETED",
          diningEvent: {
            is: {
              status: "COMPLETED"
            }
          }
        },
        select: {
          userId: true,
          diningEvent: {
            select: {
              id: true
            }
          }
        }
      }),
      db.shoppingItem.findMany({
        where: {
          userId: { in: userIds },
          sourceType: "EVENT",
          status: "BOUGHT"
        },
        select: {
          userId: true,
          sourceKey: true
        }
      })
    ]);

    const boughtEventMap = new Map<UUID, Set<UUID>>();
    for (const item of shoppingItems) {
      if (!item.sourceKey) continue;
      const eventIdText = item.sourceKey.split(":")[0];
      const eventId = Number(eventIdText);
      if (!Number.isInteger(eventId) || eventId <= 0) continue;
      const set = boughtEventMap.get(item.userId) ?? new Set<UUID>();
      set.add(eventId);
      boughtEventMap.set(item.userId, set);
    }

    const countMap = new Map<UUID, number>();
    for (const item of items) {
      const eventId = item.diningEvent?.id ?? null;
      if (!eventId) continue;
      const boughtEvents = boughtEventMap.get(item.userId);
      if (!boughtEvents?.has(eventId)) continue;
      countMap.set(item.userId, (countMap.get(item.userId) ?? 0) + 1);
    }

    return countMap;
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
