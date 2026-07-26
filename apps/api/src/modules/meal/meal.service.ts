import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type DiningEventParticipantStatus, type MealSlot } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  DiningEventParticipantSummary,
  DiningEventSummary,
  MealPlanSummary,
  PageResult,
  RecipeContentSnapshot,
  SharePreviewResponse,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import { fromJson, toJson, versionToContent } from "../recipe/recipe-content";

type MealPlanRow = Prisma.MealPlanItemGetPayload<{
  include: {
    diningEvent: true;
  };
}>;

type DiningEventRow = Prisma.DiningEventGetPayload<{
  include: {
    user: { select: { uid: true } };
    participants: {
      include: {
        user: { select: { uid: true } };
        bringRecipe: true;
      };
    };
  };
}>;

type MealDb = Prisma.TransactionClient | PrismaService;

function toIsoDate(value: Date) {
  return value.toISOString();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createShareToken() {
  return randomBytes(24).toString("base64url");
}

function parseDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("计划日期格式错误");
  return parsed;
}

function parseDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("饭局时间格式错误");
  return parsed;
}

function normalizeMealSlot(value: string): MealSlot {
  if (value !== "BREAKFAST" && value !== "LUNCH" && value !== "DINNER") {
    throw new BadRequestException("餐次参数错误");
  }
  return value;
}

function normalizeEventStatus(value: string): DiningEventParticipantStatus {
  if (value !== "ACCEPTED" && value !== "DECLINED") {
    throw new BadRequestException("参与状态参数错误");
  }
  return value;
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

@Injectable()
export class MealService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  async listMealPlans(userId: UUID, page: number, pageSize: number, from?: string, to?: string): Promise<PageResult<MealPlanSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.MealPlanItemWhereInput = {
      userId,
      ...(from || to
        ? {
            planDate: {
              ...(from ? { gte: parseDateOnly(from) } : {}),
              ...(to ? { lte: parseDateOnly(to) } : {})
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mealPlanItem.findMany({
        where,
        include: {
          diningEvent: true
        },
        orderBy: [{ planDate: "asc" }, { mealSlot: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.mealPlanItem.count({ where })
    ]);

    return {
      items: items.map(item => this.toMealPlanSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createMealPlan(
    userId: UUID,
    operationId: UUID,
    planDate: string,
    mealSlot: string,
    recipeId: UUID,
    note?: string | null
  ) {
    return this.prisma.$transaction(async tx => {
      const slot = normalizeMealSlot(mealSlot);
      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const recipeVersion = await this.resolveRecipeVersion(tx, recipe);
      const menu = this.getEffectiveRecipeContent(recipe);
      const normalizedNote = note?.trim() || null;
      const requestHash = `${planDate}:${slot}:${recipeId}:${normalizedNote ?? ""}`;
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:create", userId, null, requestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "meal-plan:create", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson({ planDate, mealSlot: slot, menu, note: normalizedNote }));

      const item = await tx.mealPlanItem.upsert({
        where: {
          userId_planDate_mealSlot: {
            userId,
            planDate: parseDateOnly(planDate),
            mealSlot: slot
          }
        },
        update: {
          recipeId,
          recipeVersionId: recipeVersion.id,
          menuSnapshot: toJson(menu),
          note: normalizedNote,
          version: { increment: 1 }
        },
        create: {
          userId,
          planDate: parseDateOnly(planDate),
          mealSlot: slot,
          recipeId,
          recipeVersionId: recipeVersion.id,
          menuSnapshot: toJson(menu),
          note: normalizedNote
        },
        include: {
          diningEvent: true
        }
      });

      await upsertStorageLedger(tx, userId, "MEAL", item.id, sizeOfJson(item));
      const result = this.toMealPlanSummary(item);
      await completeIdempotentOperation(tx, operationId, "meal-plan:create", userId, null, requestHash, result);
      return result;
    });
  }

  async createDiningEvent(userId: UUID, planItemId: UUID, operationId: UUID, scheduledAt: string, location?: string | null) {
    return this.prisma.$transaction(async tx => {
      const plan = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        include: { diningEvent: true }
      });
      if (!plan || plan.userId !== userId) throw new NotFoundException("计划不存在");
      if (plan.diningEvent) throw new ConflictException("该餐次已发起饭局");

      const shareToken = createShareToken();
      const sharePath = `/pages_share/preview/index?token=${encodeURIComponent(shareToken)}`;
      const eventRequestHash = `${planItemId}:${scheduledAt}:${location ?? ""}`;
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson({ scheduledAt, location, menu: plan.menuSnapshot }));

      const menu = fromJson<RecipeContentSnapshot>(plan.menuSnapshot);
      const event = await tx.diningEvent.create({
        data: {
          userId,
          mealPlanItemId: plan.id,
          title: menu.name,
          scheduledAt: parseDateTime(scheduledAt),
          location: location?.trim() || null,
          menuSnapshot: toJson(plan.menuSnapshot),
          shareTokenHash: hashText(shareToken),
          shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      await upsertStorageLedger(tx, userId, "MEAL", event.id, sizeOfJson(event));
      const result = await this.getDiningEvent(userId, event.id, sharePath, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash, result);
      return result;
    });
  }

  async inviteDiningGroup(userId: UUID, eventId: UUID, diningGroupId: UUID, operationId: UUID) {
    const requestHash = `${eventId}:${diningGroupId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:invite-group", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:invite-group", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");

      const membership = await tx.diningGroupMember.findUnique({
        where: {
          diningGroupId_userId: {
            diningGroupId,
            userId
          }
        },
        include: { diningGroup: true }
      });
      if (!membership || membership.role !== "OWNER" || membership.status !== "ACTIVE") {
        throw new ForbiddenException("无权从该饭搭子邀请成员");
      }

      const entitlements = await this.entitlementService.resolveForUser(tx, userId);
      const activeCount = await tx.diningGroupMember.count({
        where: {
          diningGroupId,
          status: { in: ["ACTIVE", "RESTRICTED"] }
        }
      });
      if (entitlements.state === "OVER_MEMBER_LIMIT" || activeCount > entitlements.memberLimit) {
        throw new ForbiddenException("当前饭搭子处于超额受限状态");
      }

      const members = await tx.diningGroupMember.findMany({
        where: {
          diningGroupId,
          userId: { not: userId },
          status: { in: ["ACTIVE", "RESTRICTED"] }
        }
      });
      const existing = await tx.diningEventParticipant.findMany({
        where: {
          diningEventId: eventId,
          userId: { in: members.map(item => item.userId) }
        },
        select: { userId: true }
      });
      const existingUserIds = new Set(existing.map(item => item.userId).filter(Boolean));
      for (const member of members) {
        if (existingUserIds.has(member.userId)) continue;
        const participant = await tx.diningEventParticipant.create({
          data: {
            diningEventId: eventId,
            userId: member.userId,
            sourceType: "DINING_GROUP",
            status: "INVITED"
          }
        });
        await upsertStorageLedger(tx, userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:invite-group", userId, null, requestHash, result);
      return result;
    });
  }

  async respondToDiningEvent(userId: UUID, eventId: UUID, operationId: UUID, status: string) {
    const normalizedStatus = normalizeEventStatus(status);
    const requestHash = `${eventId}:${normalizedStatus}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:respond", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:respond", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: eventId, userId },
        include: {
          diningEvent: true
        }
      });
      if (!participant) throw new NotFoundException("饭局不存在");

      await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: normalizedStatus,
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:respond", userId, null, requestHash, result);
      return result;
    });
  }

  async chooseBringRecipe(userId: UUID, eventId: UUID, recipeId: UUID, operationId: UUID) {
    const requestHash = `${eventId}:${recipeId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:bring", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:bring", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        },
        include: {
          diningEvent: true
        }
      });
      if (!participant) throw new NotFoundException("饭局不存在");

      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const recipeVersion = await this.resolveRecipeVersion(tx, recipe);

      await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          bringRecipeId: recipe.id,
          bringVersionId: recipeVersion.id
        }
      });

      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:bring", userId, null, requestHash, result);
      return result;
    });
  }

  async getDiningEvent(
    userId: UUID,
    eventId: UUID,
    shareTokenPath?: string | null,
    db: MealDb = this.prisma
  ): Promise<DiningEventSummary> {
    const event = await db.diningEvent.findUnique({
      where: { id: eventId },
      include: {
        user: { select: { uid: true } },
        participants: {
          include: {
            user: { select: { uid: true } },
            bringRecipe: true
          }
        }
      }
    });
    if (!event) throw new NotFoundException("饭局不存在");
    const isParticipant = event.participants.some(item => item.userId === userId);
    if (event.userId !== userId && !isParticipant) throw new ForbiddenException("无权查看该饭局");
    return this.toDiningEventSummary(event, shareTokenPath);
  }

  async getSharePreview(shareToken: string): Promise<SharePreviewResponse> {
    const shareTokenHash = hashText(shareToken);
    const event = await this.prisma.diningEvent.findUnique({
      where: { shareTokenHash },
      include: {
        user: { select: { uid: true } }
      }
    });
    if (!event || !event.shareTokenExpiresAt || event.shareTokenExpiresAt <= new Date()) {
      throw new NotFoundException("分享已失效");
    }

    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    return {
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      menu: {
        name: menu.name,
        ingredients: menu.ingredients
      },
      organizerUid: event.user.uid
    };
  }

  async acceptShareInvite(userId: UUID, shareToken: string, operationId: UUID, guestName: string) {
    const normalizedGuestName = guestName.trim();
    if (!normalizedGuestName) throw new BadRequestException("展示名称不能为空");
    const shareTokenHash = hashText(shareToken);
    const requestHash = `${shareTokenHash}:${normalizedGuestName}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "share:accept", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { shareTokenHash }
      });
      if (!event || !event.shareTokenExpiresAt || event.shareTokenExpiresAt <= new Date()) {
        throw new NotFoundException("分享已失效");
      }

      const existing = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: event.id, userId }
      });
      if (existing) {
        await tx.diningEventParticipant.update({
          where: { id: existing.id },
          data: {
            guestName: normalizedGuestName,
            status: "ACCEPTED",
            respondedAt: new Date(),
            sourceType: "SHARE"
          }
        });
        const result = await this.getDiningEvent(userId, event.id, undefined, tx);
        await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
        return result;
      }

      const participant = await tx.diningEventParticipant.create({
        data: {
          diningEventId: event.id,
          userId,
          guestName: normalizedGuestName,
          sourceType: "SHARE",
          status: "ACCEPTED",
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, event.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, event.id, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
      return result;
    });
  }

  private toMealPlanSummary(item: MealPlanRow) {
    const menu = fromJson<RecipeContentSnapshot>(item.menuSnapshot);
    return {
      id: item.id,
      planDate: item.planDate.toISOString().slice(0, 10),
      mealSlot: item.mealSlot,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId,
      title: menu.name,
      hasDiningEvent: Boolean(item.diningEvent),
      diningEventId: item.diningEvent?.id ?? null,
      createdAt: toIsoDate(item.createdAt)
    };
  }

  private toDiningEventSummary(event: DiningEventRow, shareTokenPath?: string | null): DiningEventSummary {
    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    return {
      id: event.id,
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      status: event.status,
      planItemId: event.mealPlanItemId,
      diningGroupId: event.diningGroupId,
      menu,
      participants: event.participants.map(item => ({
        id: item.id,
        userUid: item.user?.uid ?? null,
        guestName: item.guestName,
        sourceType: item.sourceType,
        status: item.status,
        bringRecipeId: item.bringRecipeId,
        bringRecipeTitle: item.bringRecipe?.title ?? null
      }) satisfies DiningEventParticipantSummary),
      shareTokenPath: shareTokenPath ?? null,
      createdAt: toIsoDate(event.createdAt)
    };
  }

  private getEffectiveRecipeContent(recipe: Prisma.RecipeGetPayload<{
    include: { currentVersion: true };
  }>) {
    return versionToContent(recipe.currentVersion);
  }

  private async resolveRecipeVersion(
    tx: Prisma.TransactionClient,
    recipe: Prisma.RecipeGetPayload<{
      include: { currentVersion: true };
    }>
  ) {
    return recipe.currentVersion;
  }

  private async requireOwnedRecipe(tx: Prisma.TransactionClient, userId: UUID, recipeId: UUID) {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: {
        currentVersion: true
      }
    });
    if (!recipe || recipe.ownerId !== userId || recipe.status !== "ACTIVE") {
      throw new NotFoundException("菜谱不存在");
    }
    return recipe;
  }

  private async assertStorageWritable(tx: Prisma.TransactionClient, userId: UUID, expectedDeltaBytes: number) {
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const current = await tx.storageLedger.aggregate({
      where: { userId },
      _sum: { usedBytes: true }
    });
    const usedBytes = current._sum.usedBytes ?? 0;
    if (usedBytes > entitlements.storageLimitBytes || usedBytes + expectedDeltaBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间不足");
    }
  }
}
