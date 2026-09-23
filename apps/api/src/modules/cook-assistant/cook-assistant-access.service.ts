import { HttpException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  CookAssistantUsageResponse,
  OperationId,
  RecipeWikiRequestStatus,
  RequestRecipeWikiResult,
  UnlockCookAssistantAccessResult,
  UUID
} from "../../contracts/types";
import { cookAssistantActivityConfig } from "./cook-assistant.config";

type UnlockTarget =
  | { kind: "RECIPE_VERSION"; recipeVersionId: UUID }
  | { kind: "PLAN_ITEM"; planItemId: UUID };

type CookAssistantTx = Prisma.TransactionClient;

const unlockOperationType = "cook-assistant:unlock";
const wikiRequestOperationType = "cook-assistant:wiki-request";

function shanghaiDateParts(now: Date) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function pad2(value: number) {
  return value < 10 ? `0${value}` : String(value);
}

function businessDate(now: Date) {
  const parts = shanghaiDateParts(now);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function businessDateValue(now: Date) {
  return new Date(`${businessDate(now)}T00:00:00.000Z`);
}

function nextResetAt(now: Date) {
  const parts = shanghaiDateParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1) - 8 * 60 * 60 * 1000).toISOString();
}

function activityEnabled(now: Date) {
  const config = cookAssistantActivityConfig;
  if (!config.activityEnabled) return false;
  if (config.startsAt && now < new Date(config.startsAt)) return false;
  if (config.endsAt && now >= new Date(config.endsAt)) return false;
  return true;
}

function targetHash(target: UnlockTarget) {
  if (target.kind === "RECIPE_VERSION") return `RECIPE_VERSION:${target.recipeVersionId}`;
  return `PLAN_ITEM:${target.planItemId}`;
}

function targetWhere(userId: UUID, target: UnlockTarget) {
  if (target.kind === "RECIPE_VERSION") return { userId, recipeVersionId: target.recipeVersionId };
  return { userId, planItemId: target.planItemId };
}

function targetCreate(userId: UUID, target: UnlockTarget, unlockedOn: Date) {
  if (target.kind === "RECIPE_VERSION") {
    return { userId, recipeVersionId: target.recipeVersionId, unlockedOn };
  }
  return { userId, planItemId: target.planItemId, unlockedOn };
}

async function lockDailyUsage(tx: CookAssistantTx, userId: UUID, day: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`COOK_ASSISTANT_USAGE:${userId}:${day}`}, 0))::text`;
}

@Injectable()
export class CookAssistantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(userId: UUID, now = new Date()): Promise<CookAssistantUsageResponse> {
    const unlockedOn = businessDateValue(now);
    const usedCount = await this.prisma.cookAssistantUnlock.count({
      where: {
        userId,
        unlockedOn
      }
    });
    return this.usageFromCount(usedCount, now);
  }

  async getRecipeVersionUnlock(userId: UUID, recipeVersionId: UUID) {
    return this.prisma.cookAssistantUnlock.findFirst({
      where: {
        userId,
        recipeVersionId,
        status: "CONSUMED"
      }
    });
  }

  async getRecipeWikiRequest(userId: UUID, recipeVersionId: UUID) {
    return this.prisma.recipeCookAssistantRequest.findUnique({
      where: {
        userId_recipeVersionId: {
          userId,
          recipeVersionId
        }
      }
    });
  }

  async requestRecipeWiki(
    userId: UUID,
    recipeVersionId: UUID,
    operationId: OperationId,
    now = new Date()
  ): Promise<RequestRecipeWikiResult> {
    const day = businessDate(now);
    const unlockedOn = businessDateValue(now);
    const requestHash = `RECIPE_WIKI:${recipeVersionId}`;

    return this.prisma.$transaction(async tx => {
      await lockDailyUsage(tx, userId, day);
      const repeated = await getIdempotentResult<RequestRecipeWikiResult>(
        tx,
        operationId,
        wikiRequestOperationType,
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, wikiRequestOperationType, userId, null, requestHash);

      const existingRequest = await tx.recipeCookAssistantRequest.findUnique({
        where: { userId_recipeVersionId: { userId, recipeVersionId } }
      });
      const existingUnlock = await tx.cookAssistantUnlock.findFirst({
        where: { userId, recipeVersionId, status: "CONSUMED" }
      });
      if (existingRequest?.status === "READY" || existingUnlock || existingRequest?.status === "REJECTED") {
        const result = this.wikiRequestResult(existingRequest, false, await this.todayCount(tx, userId, unlockedOn), now);
        await completeIdempotentOperation(tx, operationId, wikiRequestOperationType, userId, null, requestHash, result);
        return result;
      }

      if (!existingRequest) {
        if (!activityEnabled(now)) {
          throw new HttpException({ code: 429, message: "活动未开放", data: null }, 429);
        }
        const usedCount = await this.todayCount(tx, userId, unlockedOn);
        if (usedCount >= cookAssistantActivityConfig.dailyUnlockLimit) {
          throw new HttpException({ code: 429, message: "今日次数已用完", data: null }, 429);
        }
        await tx.cookAssistantUnlock.create({
          data: {
            userId,
            recipeVersionId,
            unlockedOn,
            status: "RESERVED"
          }
        });
      }

      const request = await tx.recipeCookAssistantRequest.upsert({
        where: { userId_recipeVersionId: { userId, recipeVersionId } },
        create: {
          userId,
          recipeVersionId,
          status: "PENDING",
          requestedAt: now
        },
        update: {
          status: "PENDING",
          requestedAt: now,
          resolvedAt: null,
          rejectionReason: null
        }
      });
      const usedCount = await this.todayCount(tx, userId, unlockedOn);
      const result = this.wikiRequestResult(request, !existingRequest, usedCount, now);
      await completeIdempotentOperation(tx, operationId, wikiRequestOperationType, userId, null, requestHash, result);
      return result;
    });
  }

  async settleRecipeWikiRequest(
    tx: CookAssistantTx,
    recipeVersionId: UUID,
    status: Extract<RecipeWikiRequestStatus, "READY" | "REJECTED">,
    now = new Date(),
    rejectionReason: string | null = null
  ) {
    const requests = await tx.recipeCookAssistantRequest.findMany({
      where: { recipeVersionId, status: "PENDING" },
      select: { userId: true }
    });
    if (!requests.length) return [];

    await tx.recipeCookAssistantRequest.updateMany({
      where: { recipeVersionId, status: "PENDING" },
      data: {
        status,
        resolvedAt: now,
        rejectionReason: status === "REJECTED" ? rejectionReason?.trim() || "菜谱内容暂不满足生成条件" : null
      }
    });
    if (status === "READY") {
      await tx.cookAssistantUnlock.updateMany({
        where: { recipeVersionId, status: "RESERVED" },
        data: { status: "CONSUMED" }
      });
    } else {
      await tx.cookAssistantUnlock.deleteMany({
        where: { recipeVersionId, status: "RESERVED" }
      });
    }
    return requests.map(item => item.userId);
  }

  async getMealPlanUnlock(userId: UUID, planItemId: UUID) {
    return this.prisma.cookAssistantUnlock.findFirst({
      where: {
        userId,
        planItemId
      }
    });
  }

  unlockRecipeVersion(userId: UUID, recipeVersionId: UUID, operationId: OperationId, now = new Date()) {
    return this.unlockTarget(userId, { kind: "RECIPE_VERSION", recipeVersionId }, operationId, now);
  }

  unlockMealPlan(userId: UUID, planItemId: UUID, operationId: OperationId, now = new Date()) {
    return this.unlockTarget(userId, { kind: "PLAN_ITEM", planItemId }, operationId, now);
  }

  private async unlockTarget(
    userId: UUID,
    target: UnlockTarget,
    operationId: OperationId,
    now: Date
  ): Promise<UnlockCookAssistantAccessResult> {
    const day = businessDate(now);
    const unlockedOn = businessDateValue(now);
    const requestHash = targetHash(target);

    return this.prisma.$transaction(async tx => {
      await lockDailyUsage(tx, userId, day);
      const repeated = await getIdempotentResult<UnlockCookAssistantAccessResult>(
        tx,
        operationId,
        unlockOperationType,
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, unlockOperationType, userId, null, requestHash);

      const existing = await tx.cookAssistantUnlock.findFirst({
        where: target.kind === "RECIPE_VERSION"
          ? { ...targetWhere(userId, target), status: "CONSUMED" }
          : targetWhere(userId, target)
      });
      if (existing) {
        const usedCount = await this.todayCount(tx, userId, unlockedOn);
        const result = this.unlockResult(false, existing.unlockedAt, usedCount, now);
        await completeIdempotentOperation(tx, operationId, unlockOperationType, userId, null, requestHash, result);
        return result;
      }

      if (target.kind === "RECIPE_VERSION") {
        const reserved = await tx.cookAssistantUnlock.findFirst({
          where: { ...targetWhere(userId, target), status: "RESERVED" }
        });
        if (reserved) throw new HttpException({ code: 409, message: "Wiki 正在制作中", data: null }, 409);
      }

      if (!activityEnabled(now)) {
        throw new HttpException({ code: 429, message: "活动未开放", data: null }, 429);
      }

      const usedCount = await this.todayCount(tx, userId, unlockedOn);
      if (usedCount >= cookAssistantActivityConfig.dailyUnlockLimit) {
        throw new HttpException({ code: 429, message: "今日次数已用完", data: null }, 429);
      }

      const created = await tx.cookAssistantUnlock.create({
        data: targetCreate(userId, target, unlockedOn)
      });
      const result = this.unlockResult(true, created.unlockedAt, usedCount + 1, now);
      await completeIdempotentOperation(tx, operationId, unlockOperationType, userId, null, requestHash, result);
      return result;
    });
  }

  private todayCount(tx: CookAssistantTx, userId: UUID, unlockedOn: Date) {
    return tx.cookAssistantUnlock.count({
      where: {
        userId,
        unlockedOn
      }
    });
  }

  private unlockResult(newlyUnlocked: boolean, unlockedAt: Date, usedCount: number, now: Date): UnlockCookAssistantAccessResult {
    return {
      newlyUnlocked,
      unlockedAt: unlockedAt.toISOString(),
      usage: this.usageFromCount(usedCount, now)
    };
  }

  private wikiRequestResult(
    request: { status: RecipeWikiRequestStatus; requestedAt: Date; rejectionReason: string | null } | null,
    newlyRequested: boolean,
    usedCount: number,
    now: Date
  ): RequestRecipeWikiResult {
    return {
      status: request?.status ?? "PENDING",
      requestAt: request ? request.requestedAt.toISOString() : null,
      rejectionReason: request?.rejectionReason ?? null,
      newlyRequested,
      usage: this.usageFromCount(usedCount, now)
    };
  }

  private usageFromCount(usedCount: number, now: Date): CookAssistantUsageResponse {
    const dailyUnlockLimit = cookAssistantActivityConfig.dailyUnlockLimit;
    return {
      activityEnabled: activityEnabled(now),
      businessDate: businessDate(now),
      dailyUnlockLimit,
      usedCount,
      remainingCount: Math.max(dailyUnlockLimit - usedCount, 0),
      resetsAt: activityEnabled(now) ? nextResetAt(now) : null
    };
  }
}
