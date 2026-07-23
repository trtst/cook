import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  FridgeItemSummary,
  PageResult,
  RecipeContentPayload,
  ShoppingItemSummary,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import { fromJson } from "../recipe/recipe-content";

function toIsoDate(value: Date) {
  return value.toISOString();
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function normalizeShoppingStatus(value: string) {
  if (value !== "OPEN" && value !== "BOUGHT" && value !== "DELETED") {
    throw new BadRequestException("购物状态参数错误");
  }
  return value;
}

@Injectable()
export class PantryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  async listFridge(userId: UUID, page: number, pageSize: number): Promise<PageResult<FridgeItemSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fridgeItem.findMany({
        where,
        orderBy: [{ available: "desc" }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.fridgeItem.count({ where })
    ]);

    return {
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        quantityText: item.quantityText,
        note: item.note,
        available: item.available,
        updatedAt: toIsoDate(item.updatedAt)
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createFridgeItem(userId: UUID, operationId: UUID, name: string, quantityText?: string | null, note?: string | null) {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const requestHash = JSON.stringify(normalized);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeItemSummary>(tx, operationId, "fridge:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge:create", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson(normalized));

      const item = await tx.fridgeItem.create({
        data: {
          userId,
          name: normalized.name,
          quantityText: normalized.quantityText,
          note: normalized.note
        }
      });
      await upsertStorageLedger(tx, userId, "FRIDGE", item.id, sizeOfJson(item));
      const result = this.toFridgeItemSummary(item);
      await completeIdempotentOperation(tx, operationId, "fridge:create", userId, null, requestHash, result);
      return result;
    });
  }

  async updateFridgeItem(userId: UUID, itemId: UUID, operationId: UUID, name: string, quantityText?: string | null, note?: string | null) {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const requestHash = `${itemId}:${JSON.stringify(normalized)}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeItemSummary>(tx, operationId, "fridge:update", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge:update", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, 0);

      const item = await tx.fridgeItem.findUnique({ where: { id: itemId } });
      if (!item || item.userId !== userId) throw new NotFoundException("食材不存在");

      const next = await tx.fridgeItem.update({
        where: { id: itemId },
        data: normalized
      });
      await upsertStorageLedger(tx, userId, "FRIDGE", next.id, sizeOfJson(next));
      const result = this.toFridgeItemSummary(next);
      await completeIdempotentOperation(tx, operationId, "fridge:update", userId, null, requestHash, result);
      return result;
    });
  }

  async consumeFridgeItems(userId: UUID, operationId: UUID, itemIds: UUID[]) {
    const uniqueIds = Array.from(new Set(itemIds));
    const requestHash = uniqueIds.join(",");
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<PageResult<FridgeItemSummary>>(tx, operationId, "fridge:consume", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge:consume", userId, null, requestHash);

      await tx.fridgeItem.updateMany({
        where: {
          id: { in: uniqueIds },
          userId
        },
        data: {
          available: false,
          consumedAt: new Date()
        }
      });

      const result = await this.listFridge(userId, 1, 50);
      await completeIdempotentOperation(tx, operationId, "fridge:consume", userId, null, requestHash, result);
      return result;
    });
  }

  async listShopping(userId: UUID, page: number, pageSize: number, status?: string): Promise<PageResult<ShoppingItemSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.ShoppingItemWhereInput = {
      userId,
      ...(status ? { status: normalizeShoppingStatus(status) } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.shoppingItem.findMany({
        where,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.shoppingItem.count({ where })
    ]);

    return {
      items: items.map(this.toShoppingItemSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createShoppingItem(userId: UUID, operationId: UUID, name: string, quantityText?: string | null, note?: string | null) {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const requestHash = JSON.stringify(normalized);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingItemSummary>(tx, operationId, "shopping:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:create", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson(normalized));
      const item = await tx.shoppingItem.create({
        data: {
          userId,
          name: normalized.name,
          quantityText: normalized.quantityText,
          note: normalized.note,
          sourceType: "MANUAL"
        }
      });
      await upsertStorageLedger(tx, userId, "SHOPPING", item.id, sizeOfJson(item));
      const result = this.toShoppingItemSummary(item);
      await completeIdempotentOperation(tx, operationId, "shopping:create", userId, null, requestHash, result);
      return result;
    });
  }

  async updateShoppingStatus(userId: UUID, itemId: UUID, operationId: UUID, status: string) {
    const normalizedStatus = normalizeShoppingStatus(status);
    const requestHash = `${itemId}:${normalizedStatus}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingItemSummary>(tx, operationId, "shopping:status", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:status", userId, null, requestHash);

      const item = await tx.shoppingItem.findUnique({ where: { id: itemId } });
      if (!item || item.userId !== userId) throw new NotFoundException("购物项不存在");

      const next = await tx.shoppingItem.update({
        where: { id: itemId },
        data: {
          status: normalizedStatus
        }
      });

      if (normalizedStatus === "DELETED") {
        await removeStorageLedger(tx, userId, "SHOPPING", itemId);
      } else {
        await upsertStorageLedger(tx, userId, "SHOPPING", itemId, sizeOfJson(next));
      }

      const result = this.toShoppingItemSummary(next);
      await completeIdempotentOperation(tx, operationId, "shopping:status", userId, null, requestHash, result);
      return result;
    });
  }

  async previewEventGap(userId: UUID, eventId: UUID): Promise<ShoppingItemSummary[]> {
    const [event, fridgeItems] = await Promise.all([
      this.prisma.diningEvent.findUnique({
        where: { id: eventId }
      }),
      this.prisma.fridgeItem.findMany({
        where: {
          userId,
          available: true
        }
      })
    ]);
    if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");

    const ownedIngredientKeys = new Set(fridgeItems.map(item => item.name.trim().toLowerCase()));
    const menu = fromJson<RecipeContentPayload>(event.menuSnapshot);

    return menu.ingredients
      .filter(item => !ownedIngredientKeys.has(item.name.trim().toLowerCase()))
      .map((item, index) => ({
        id: `preview-${eventId}-${index}`,
        name: item.name,
        quantityText: item.amount,
        note: "来自饭局菜单缺口",
        sourceType: "EVENT",
        sourceKey: `${eventId}:${item.name}`,
        status: "OPEN",
        updatedAt: toIsoDate(event.updatedAt)
      }));
  }

  async createEventGap(userId: UUID, eventId: UUID, operationId: UUID) {
    const requestHash = eventId;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingItemSummary[]>(tx, operationId, "shopping:gap", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:gap", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, 0);

      const preview = await this.previewEventGap(userId, eventId);
      const results: ShoppingItemSummary[] = [];
      for (const item of preview) {
        const existing = await tx.shoppingItem.findFirst({
          where: {
            userId,
            sourceType: "EVENT",
            sourceKey: item.sourceKey,
            status: "OPEN"
          }
        });
        if (existing) {
          results.push(this.toShoppingItemSummary(existing));
          continue;
        }

        const created = await tx.shoppingItem.create({
          data: {
            userId,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: "EVENT",
            sourceKey: item.sourceKey
          }
        });
        await upsertStorageLedger(tx, userId, "SHOPPING", created.id, sizeOfJson(created));
        results.push(this.toShoppingItemSummary(created));
      }

      await completeIdempotentOperation(tx, operationId, "shopping:gap", userId, null, requestHash, results);
      return results;
    });
  }

  private normalizePantryFields(name: string, quantityText?: string | null, note?: string | null) {
    const normalizedName = name.trim();
    if (!normalizedName) throw new BadRequestException("名称不能为空");
    return {
      name: normalizedName,
      quantityText: quantityText?.trim() || null,
      note: note?.trim() || null
    };
  }

  private async assertStorageWritable(tx: Prisma.TransactionClient, userId: UUID, expectedDeltaBytes: number) {
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const current = await tx.storageLedger.aggregate({
      where: { userId },
      _sum: { usedBytes: true }
    });
    const usedBytes = current._sum.usedBytes ?? 0;
    if (usedBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间已超额，只允许清理和查看");
    }
    if (usedBytes + expectedDeltaBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间不足");
    }
  }

  private toFridgeItemSummary(item: {
    id: string;
    name: string;
    quantityText: string | null;
    note: string | null;
    available: boolean;
    updatedAt: Date;
  }): FridgeItemSummary {
    return {
      id: item.id,
      name: item.name,
      quantityText: item.quantityText,
      note: item.note,
      available: item.available,
      updatedAt: toIsoDate(item.updatedAt)
    };
  }

  private toShoppingItemSummary = (item: {
    id: string;
    name: string;
    quantityText: string | null;
    note: string | null;
    sourceType: "MANUAL" | "PLAN" | "EVENT" | "BRING";
    sourceKey: string | null;
    status: "OPEN" | "BOUGHT" | "DELETED";
    updatedAt: Date;
  }): ShoppingItemSummary => ({
    id: item.id,
    name: item.name,
    quantityText: item.quantityText,
    note: item.note,
    sourceType: item.sourceType,
    sourceKey: item.sourceKey,
    status: item.status,
    updatedAt: toIsoDate(item.updatedAt)
  });
}
