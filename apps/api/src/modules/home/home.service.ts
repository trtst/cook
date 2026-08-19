import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type HomeEntryStatus, type HomeFeatureBoardCard, type HomeFeatureBoardPlacement, type HomeFeatureBoardTargetType, Prisma } from "@prisma/client";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  AdminHomeEntriesResponse,
  AdminHomeEntryItem,
  HomeEntriesResponse,
  HomeEntryItem,
  HomeEntryPageTarget,
  OperationId,
  SetHomeEntryStatusRequest,
  UUID,
  UpdateHomeEntriesRequest
} from "../../contracts/types";
import { HomeImageService } from "./home-image.service";

type BoardDb = Prisma.TransactionClient | PrismaService;
type HomeCardInput = Pick<HomeFeatureBoardCard, "placement" | "title" | "subtitle" | "targetType" | "targetValue" | "artImageUrl" | "badgeText">;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const featurePlacements: HomeFeatureBoardPlacement[] = ["MAIN", "SIDE_TOP", "SIDE_BOTTOM"];
const quickPlacements: HomeFeatureBoardPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];
const allPlacements: HomeFeatureBoardPlacement[] = [...featurePlacements, ...quickPlacements];
const placementIds: Record<HomeFeatureBoardPlacement, string> = {
  MAIN: "feature-main",
  SIDE_TOP: "feature-side-top",
  SIDE_BOTTOM: "feature-side-bottom",
  QUICK_1: "quick-1",
  QUICK_2: "quick-2",
  QUICK_3: "quick-3",
  QUICK_4: "quick-4"
};
const pageTargets: HomeEntryPageTarget[] = [
  { label: "下一餐计划", value: "/pages_meal/plan/index" },
  { label: "随机吃什么", value: "/pages_meal/random/index" },
  { label: "采购缺口", value: "/pages_pantry/gap/index" },
  { label: "食材与采购", value: "/pages_pantry/index/index" },
  { label: "本周灵感", value: "/pages_home/topic/index" },
  { label: "餐桌话题", value: "/pages_home/table-topic/index" },
  { label: "菜谱", value: "/pages/recipe/index" },
  { label: "我的菜谱管理", value: "/pages_recipe/list/index" }
];
const pageTargetSet = new Set(pageTargets.map(item => item.value));
const imagePathPattern = /^\/api\/public-assets\/home-entries\/(MAIN|SIDE_TOP|SIDE_BOTTOM|QUICK_1|QUICK_2|QUICK_3|QUICK_4)$/i;
const defaultCards: Record<HomeFeatureBoardPlacement, Omit<HomeCardInput, "placement">> = {
  MAIN: {
    title: "一起吃饭",
    subtitle: "挑挑自己想吃的",
    targetType: "PAGE",
    targetValue: "/pages_meal/plan/index",
    artImageUrl: null,
    badgeText: null
  },
  SIDE_TOP: {
    title: "本周灵感",
    subtitle: "这周吃点不一样",
    targetType: "PAGE",
    targetValue: "/pages_home/topic/index",
    artImageUrl: null,
    badgeText: "周"
  },
  SIDE_BOTTOM: {
    title: "餐桌话题",
    subtitle: "看看最近吃什么",
    targetType: "PAGE",
    targetValue: "/pages_home/table-topic/index",
    artImageUrl: null,
    badgeText: "题"
  },
  QUICK_1: {
    title: "翻菜谱",
    subtitle: "先挑想做的",
    targetType: "PAGE",
    targetValue: "/pages/recipe/index",
    artImageUrl: null,
    badgeText: "谱"
  },
  QUICK_2: {
    title: "看食材",
    subtitle: "先看家里有啥",
    targetType: "PAGE",
    targetValue: "/pages_pantry/index/index",
    artImageUrl: null,
    badgeText: "材"
  },
  QUICK_3: {
    title: "随机",
    subtitle: "不纠结",
    targetType: "PAGE",
    targetValue: "/pages_meal/random/index",
    artImageUrl: null,
    badgeText: "随"
  },
  QUICK_4: {
    title: "缺什么",
    subtitle: "买菜前看",
    targetType: "PAGE",
    targetValue: "/pages_pantry/gap/index",
    artImageUrl: null,
    badgeText: "缺"
  }
};

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isInternalImagePath(value: string | null | undefined) {
  return Boolean(value && imagePathPattern.test(value));
}

function getPlacementLabel(placement: HomeFeatureBoardPlacement) {
  if (placement === "MAIN") return "主卡";
  if (placement === "SIDE_TOP") return "右上卡";
  if (placement === "SIDE_BOTTOM") return "右下卡";
  if (placement === "QUICK_1") return "快捷入口 1";
  if (placement === "QUICK_2") return "快捷入口 2";
  if (placement === "QUICK_3") return "快捷入口 3";
  return "快捷入口 4";
}

function isQuickPlacement(placement: HomeFeatureBoardPlacement) {
  return quickPlacements.includes(placement);
}

function assertHomeTarget(item: { placement: HomeFeatureBoardPlacement; targetType: HomeFeatureBoardTargetType; targetValue: string }) {
  if (item.targetType === "PAGE") {
    if (!pageTargetSet.has(item.targetValue)) {
      throw new BadRequestException(`${getPlacementLabel(item.placement)}的站内页面地址不在允许列表`);
    }
    return;
  }

  if (!/^https:\/\//iu.test(item.targetValue)) {
    throw new BadRequestException(`${getPlacementLabel(item.placement)}的外链地址必须以 https:// 开头`);
  }
}

@Injectable()
export class HomeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HomeImageService) private readonly homeImageService: HomeImageService
  ) {}

  async getHomeEntries(request: RequestLike): Promise<HomeEntriesResponse> {
    const items = await this.listCards();
    return {
      items: [
        ...featurePlacements.map(placement => this.toPublicItem(request, this.requireMappedCard(items, placement))),
        ...quickPlacements
          .map(placement => this.requireMappedCard(items, placement))
          .filter(item => item.status === "LISTED")
          .map(item => this.toPublicItem(request, item))
      ]
    };
  }

  async getAdminHomeEntries(): Promise<AdminHomeEntriesResponse> {
    return this.getAdminEntries(this.prisma);
  }

  async updateAdminHomeEntries(
    adminId: UUID,
    operationId: OperationId,
    body: UpdateHomeEntriesRequest
  ): Promise<AdminHomeEntriesResponse> {
    const items = this.updateItems(body.items);
    const requestHash = hashText(JSON.stringify(items));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeEntriesResponse>(
        tx,
        operationId,
        "admin-home-entries:update",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:update", adminId, requestHash);

      const currentItems = await this.listCards(tx);
      const currentMap = new Map(currentItems.map(item => [item.placement, item]));

      for (const item of items) {
        const current = currentMap.get(item.placement);
        if (!current) {
          throw new ConflictException("首页快捷入口初始化失败，请刷新后重试");
        }
        if (current.version !== item.expectedVersion) {
          throw new ConflictException(`${getPlacementLabel(item.placement)}已被更新，请刷新后重试`);
        }
      }

      await Promise.all(
        items.map(item =>
          tx.homeFeatureBoardCard.update({
            where: { placement: item.placement },
            data: {
              title: item.title,
              subtitle: item.subtitle,
              targetType: item.targetType,
              targetValue: item.targetValue,
              artImageUrl: item.artImageUrl,
              badgeText: item.badgeText,
              version: { increment: 1 }
            }
          })
        )
      );

      const result = await this.getAdminEntries(tx);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:update", adminId, requestHash, result);
      return result;
    });
  }

  async setAdminHomeEntryStatus(
    adminId: UUID,
    operationId: OperationId,
    placement: HomeFeatureBoardPlacement,
    body: SetHomeEntryStatusRequest
  ): Promise<AdminHomeEntryItem> {
    if (!isQuickPlacement(placement)) {
      throw new BadRequestException("只有首页四宫格入口支持上架和下架");
    }

    const requestHash = hashText(JSON.stringify({ placement, status: body.status, expectedVersion: body.expectedVersion }));
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeEntryItem>(
        tx,
        operationId,
        "admin-home-entries:status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:status", adminId, requestHash);

      const current = await this.requireCard(tx, placement);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException(`${getPlacementLabel(placement)}已被更新，请刷新后重试`);
      }

      const updated =
        current.status === body.status
          ? current
          : await tx.homeFeatureBoardCard.update({
              where: { placement },
              data: {
                status: body.status,
                version: { increment: 1 }
              }
            });

      const result = this.toAdminItem(updated);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:status", adminId, requestHash, result);
      return result;
    });
  }

  async uploadAdminHomeEntryImage(
    adminId: UUID,
    operationId: OperationId,
    placement: HomeFeatureBoardPlacement,
    expectedVersion: number,
    file: { buffer?: Buffer; size?: number } | undefined
  ): Promise<AdminHomeEntryItem> {
    const staged = await this.homeImageService.stageImageUpload(placement, file);
    const requestHash = createHash("sha256")
      .update("upload:")
      .update(placement)
      .update(":")
      .update(String(expectedVersion))
      .update(":")
      .update(staged.kind)
      .update(":")
      .update(file?.buffer ?? Buffer.alloc(0))
      .digest("hex");

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminHomeEntryItem>(
          tx,
          operationId,
          "admin-home-entries:image:upload",
          adminId,
          requestHash
        );
        if (repeated) return repeated;

        await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:upload", adminId, requestHash);

        const current = await this.requireCard(tx, placement);
        if (current.version !== expectedVersion) {
          throw new ConflictException(`${getPlacementLabel(placement)}已被更新，请刷新后重试`);
        }

        const backupPath = await this.homeImageService.replaceStagedImage(placement, staged.tempPath, staged.kind);
        try {
          const updated = await tx.homeFeatureBoardCard.update({
            where: { placement },
            data: {
              artImageUrl: this.homeImageService.buildImagePath(placement),
              version: { increment: 1 }
            }
          });
          await this.homeImageService.finalizeReplacedImage(backupPath);
          const result = this.toAdminItem(updated);
          await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:upload", adminId, requestHash, result);
          return result;
        } catch (error) {
          await this.homeImageService.rollbackReplacedImage(placement, backupPath);
          throw error;
        }
      });
    } finally {
      await this.homeImageService.discardStagedImage(staged.tempPath);
    }
  }

  async clearAdminHomeEntryImage(
    adminId: UUID,
    operationId: OperationId,
    placement: HomeFeatureBoardPlacement,
    expectedVersion: number
  ): Promise<AdminHomeEntryItem> {
    const requestHash = `clear:${placement}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeEntryItem>(
        tx,
        operationId,
        "admin-home-entries:image:clear",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:clear", adminId, requestHash);

      const current = await this.requireCard(tx, placement);
      if (current.version !== expectedVersion) {
        throw new ConflictException(`${getPlacementLabel(placement)}已被更新，请刷新后重试`);
      }

      const backupPath =
        current.artImageUrl === this.homeImageService.buildImagePath(placement)
          ? await this.homeImageService.stageClearImage(placement)
          : null;

      try {
        const updated = await tx.homeFeatureBoardCard.update({
          where: { placement },
          data: {
            artImageUrl: null,
            version: { increment: 1 }
          }
        });
        await this.homeImageService.finalizeClearedImage(backupPath);
        const result = this.toAdminItem(updated);
        await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:clear", adminId, requestHash, result);
        return result;
      } catch (error) {
        await this.homeImageService.rollbackClearedImage(placement, backupPath);
        throw error;
      }
    });
  }

  async getHomeEntryImageAsset(placement: HomeFeatureBoardPlacement) {
    const item = await this.requireCard(this.prisma, placement);
    if (item.artImageUrl !== this.homeImageService.buildImagePath(placement)) {
      throw new NotFoundException("首页快捷入口图片不存在");
    }
    return this.homeImageService.getImageAsset(placement);
  }

  private async getAdminEntries(db: BoardDb): Promise<AdminHomeEntriesResponse> {
    const items = await this.listCards(db);
    return {
      items: allPlacements.map(placement => this.toAdminItem(this.requireMappedCard(items, placement))),
      pageTargets
    };
  }

  private async listCards(db: BoardDb = this.prisma) {
    await this.ensureCards(db);
    const items = await db.homeFeatureBoardCard.findMany({
      where: { placement: { in: allPlacements } }
    });
    const legacyItems = items.filter(item => item.targetType === "PAGE" && !pageTargetSet.has(item.targetValue));
    if (!legacyItems.length) {
      return items;
    }

    await Promise.all(
      legacyItems.map(item =>
        db.homeFeatureBoardCard.update({
          where: { placement: item.placement },
          data: {
            ...defaultCards[item.placement],
            version: { increment: 1 }
          }
        })
      )
    );

    return db.homeFeatureBoardCard.findMany({
      where: { placement: { in: allPlacements } }
    });
  }

  private async ensureCards(db: BoardDb) {
    await db.homeFeatureBoardCard.createMany({
      data: allPlacements.map(placement => ({
        placement,
        status: "LISTED" as HomeEntryStatus,
        ...defaultCards[placement]
      })),
      skipDuplicates: true
    });
  }

  private updateItems(items: UpdateHomeEntriesRequest["items"]): Array<HomeCardInput & { expectedVersion: number }> {
    if (!items.length) {
      throw new BadRequestException("首页快捷入口至少提交 1 个坑位");
    }
    if (items.length > allPlacements.length) {
      throw new BadRequestException("首页快捷入口最多提交 7 个坑位");
    }

    const uniquePlacements = new Set<HomeFeatureBoardPlacement>();
    return items.map(item => {
      const entry: HomeCardInput & { expectedVersion: number } = {
        placement: item.placement,
        title: item.title.trim(),
        subtitle: cleanText(item.subtitle),
        targetType: item.targetType,
        targetValue: item.targetValue.trim(),
        artImageUrl: cleanText(item.imageUrl),
        badgeText: cleanText(item.badgeText),
        expectedVersion: item.expectedVersion
      };
      if (uniquePlacements.has(entry.placement)) {
        throw new BadRequestException("首页快捷入口存在重复坑位");
      }
      uniquePlacements.add(entry.placement);
      assertHomeTarget(entry);
      return entry;
    });
  }

  private async requireCard(db: BoardDb, placement: HomeFeatureBoardPlacement) {
    await this.ensureCards(db);
    const item = await db.homeFeatureBoardCard.findUnique({
      where: { placement }
    });
    if (!item) {
      throw new ConflictException("首页快捷入口初始化失败，请刷新后重试");
    }
    return item;
  }

  private requireMappedCard(items: HomeFeatureBoardCard[], placement: HomeFeatureBoardPlacement) {
    const item = items.find(entry => entry.placement === placement);
    if (!item) {
      throw new ConflictException("首页快捷入口初始化失败，请刷新后重试");
    }
    return item;
  }

  private toPublicItem(request: RequestLike, item: HomeFeatureBoardCard): HomeEntryItem {
    return {
      id: placementIds[item.placement],
      placement: item.placement,
      title: item.title,
      subtitle: item.subtitle,
      targetType: item.targetType,
      targetValue: item.targetValue,
      imageUrl: this.resolveImageUrl(request, item),
      badgeText: item.badgeText
    };
  }

  private toAdminItem(item: HomeFeatureBoardCard): AdminHomeEntryItem {
    return {
      id: placementIds[item.placement],
      placement: item.placement,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      targetType: item.targetType,
      targetValue: item.targetValue,
      imageUrl: item.artImageUrl,
      badgeText: item.badgeText,
      version: item.version
    };
  }

  private resolveImageUrl(request: RequestLike, item: HomeFeatureBoardCard) {
    if (!item.artImageUrl) return null;
    if (isInternalImagePath(item.artImageUrl)) {
      const path = `${item.artImageUrl}?v=${encodeURIComponent(item.updatedAt.toISOString())}`;
      return this.toAbsoluteUrl(request, path);
    }
    if (item.artImageUrl.startsWith("/")) {
      return this.toAbsoluteUrl(request, item.artImageUrl);
    }
    return item.artImageUrl;
  }

  private toAbsoluteUrl(request: RequestLike, path: string) {
    const host = request.get?.("host");
    if (!host) return path;
    const proto = request.get?.("x-forwarded-proto") || request.protocol || "https";
    return `${proto}://${host}${path}`;
  }
}
