import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma, type ShoppingSourceType } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  CompleteShoppingListEntryRequest,
  CreateRandomMenuShoppingItemRequest,
  FridgeItemSummary,
  ShoppingListCollaborator,
  ShoppingListInviteActionResponse,
  ShoppingListInviteFilter,
  ShoppingListInvitePageResponse,
  ShoppingListInviteStatus,
  ShoppingListInviteSummary,
  ShoppingListDetail,
  ShoppingListDetailItem,
  ShoppingListItemFridgeActionMode,
  ShoppingListItemPatchResponse,
  ShoppingInventoryStatus,
  ShoppingListPageResponse,
  ShoppingListStatusCount,
  ShoppingListSummary,
  ShoppingListSummaryResponse,
  ShareShoppingListLinkResponse,
  ShoppingSharePreview,
  ShoppingItemSourceSummary,
  OperationId,
  PageResult,
  RecipeAmountSnapshot,
  RecipeContentSnapshot,
  ShoppingBoardResponse,
  ShoppingIngredientGroup,
  ShoppingRecipeGroup,
  ShoppingRecipeIngredientGroup,
  ShoppingItemSummary,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import { formatRecipeAmount, fromJson, versionToContent } from "../recipe/recipe-content";
import { IngredientImageService } from "../admin/ingredient-image.service";

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

function toListItemStatus(value: "OPEN" | "BOUGHT" | "DELETED"): "OPEN" | "CHECKED" | "REMOVED" {
  if (value === "BOUGHT") return "CHECKED";
  if (value === "DELETED") return "REMOVED";
  return "OPEN";
}

function normalizeShoppingListInviteFilter(value: string | undefined): ShoppingListInviteFilter {
  if (!value) return "PENDING";
  if (value === "ALL" || value === "PENDING" || value === "RESOLVED") return value;
  throw new BadRequestException("邀请筛选参数错误");
}

function addDays(base: Date, days: number) {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function normalizeNameKey(value: string) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type GapEvent = {
  id: UUID;
  title: string;
  updatedAt: Date;
  menuSnapshot: Prisma.JsonValue;
};

type GapItemSeed = {
  eventId: UUID;
  eventTitle: string;
  ingredientId: UUID;
  ingredientName: string;
  amount: RecipeAmountSnapshot;
  updatedAt: Date;
  index: number;
};

type GapGroup = {
  name: string;
  amount: RecipeAmountSnapshot;
  sourceKey: string;
  sourceCount: number;
  sourceTitles: string[];
  updatedAt: Date;
};

type ShoppingRow = {
  id: UUID;
  listId: UUID | null;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  sourceKey: string | null;
  sourceRecipeId: UUID | null;
  sourceRecipeVersionId: UUID | null;
  sourceRecipeTitle: string | null;
  sourceBaseServings: number | null;
  sourceBatchKey: string | null;
  sourceIngredientSort: number | null;
  ingredientId: UUID | null;
  amountJson: Prisma.JsonValue | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  checkedAt: Date | null;
  updatedAt: Date;
};

type RecipeShoppingRow = ShoppingRow & {
  sourceType: "RECIPE";
  sourceKey: string;
  sourceRecipeId: UUID;
  sourceRecipeVersionId: UUID;
  sourceRecipeTitle: string;
  sourceBaseServings: number;
  sourceBatchKey: string;
  sourceIngredientSort: number;
  ingredientId: UUID;
  amountJson: Prisma.JsonValue;
};

type RecipeShoppingSource = {
  recipeId: UUID;
  sourceVersionId: UUID;
  title: string;
  baseServings: number;
  ingredients: RecipeContentSnapshot["ingredients"];
};

type PlanShoppingRecipe = {
  recipeId: UUID;
  sourceVersionId: UUID;
};

type ExactAmountGroup = {
  unitId: UUID;
  unitName: string;
  quantity: Prisma.Decimal;
};

type FridgeMatchRow = {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  quantityText: string | null;
  exactQuantity: Prisma.Decimal | null;
  exactUnitId: UUID | null;
  exactUnitName: string | null;
  available: boolean;
};

type FridgeReservationSummaryRow = {
  shoppingListId: UUID;
  shoppingListName: string;
  shoppingItemId: UUID;
  reservedQuantity: Prisma.Decimal;
  reservedUnitName: string;
};

type ShoppingItemFridgeMeta = {
  requiredQuantityText: string | null;
  remainingQuantityText: string | null;
  appliedInventoryQuantityText: string | null;
  fridgeText: string | null;
  inventoryStatus: ShoppingInventoryStatus;
  inventoryApplied: boolean;
  inventoryCovered: boolean;
  fridgeStatusText: string | null;
  fridgeActionLabel: string | null;
  fridgeActionMode: ShoppingListItemFridgeActionMode;
};

type ShoppingListProgressRow = {
  ingredientId: UUID | null;
  name: string;
  status: "OPEN" | "BOUGHT" | "DELETED";
  fridgeCovered: boolean;
};

type EntitlementReader = Pick<Prisma.TransactionClient, "entitlementGrant" | "diningGroupMember" | "diningGroup">;

const recipeSourceType = "RECIPE" as ShoppingSourceType;
const planSourceType = "PLAN" as ShoppingSourceType;

const shoppingRowSelect = {
  id: true,
  listId: true,
  name: true,
  quantityText: true,
  note: true,
  sourceType: true,
  sourceKey: true,
  sourceRecipeId: true,
  sourceRecipeVersionId: true,
  sourceRecipeTitle: true,
  sourceBaseServings: true,
  sourceBatchKey: true,
  sourceIngredientSort: true,
  ingredientId: true,
  amountJson: true,
  status: true,
  checkedAt: true,
  updatedAt: true
} satisfies Prisma.ShoppingItemSelect;

const shoppingDetailItemSelect = {
  id: true,
  ingredientId: true,
  name: true,
  quantityText: true,
  baseQuantityText: true,
  fridgeAppliedQuantityText: true,
  fridgeCovered: true,
  note: true,
  status: true,
  checkedAt: true,
  updatedAt: true,
  sourceType: true,
  sourceKey: true,
  sourceRecipeId: true,
  sourceRecipeVersionId: true,
  sourceRecipeTitle: true,
  sourceBaseServings: true,
  sourceBatchKey: true,
  amountJson: true,
  ingredient: {
    select: {
      ownerId: true,
      id: true,
      imageUpdatedAt: true,
      category: {
        select: {
          name: true
        }
      }
    }
  }
} satisfies Prisma.ShoppingItemSelect;

type ShoppingDetailItemRow = Prisma.ShoppingItemGetPayload<{ select: typeof shoppingDetailItemSelect }>;

@Injectable()
export class PantryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(IngredientImageService) private readonly ingredientImageService: IngredientImageService
  ) {}

  async listFridge(userId: UUID, page: number, pageSize: number): Promise<PageResult<FridgeItemSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where = { userId };
    return this.prisma.$transaction(async tx => {
      const [items, total] = await Promise.all([
        tx.fridgeItem.findMany({
          where,
          orderBy: [{ available: "desc" }, { updatedAt: "desc" }],
          skip,
          take: normalizedPageSize,
          include: {
            ingredient: {
              select: {
                category: {
                  select: {
                    name: true
                  }
                }
              }
            },
            exactUnit: {
              select: {
                id: true,
                name: true
              }
            },
            sourceShoppingItem: {
              select: {
                amountJson: true
              }
            }
          }
        }),
        tx.fridgeItem.count({ where })
      ]);
      const reservationMap = await this.loadFridgeReservationMap(tx, items.map(item => item.id));

      return {
        items: items.map(item => this.toFridgeItemSummary(item, reservationMap.get(item.id) ?? [])),
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        hasNext: skip + items.length < total
      };
    });
  }

  async createFridgeItem(
    userId: UUID,
    operationId: OperationId,
    name: string,
    ingredientId: UUID | null,
    quantityText?: string | null,
    exactQuantity?: string | null,
    exactUnitId?: UUID | null,
    expireAt?: string | null,
    note?: string | null
  ) {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const normalizedExpireAt = this.normalizeExpireAt(expireAt);
    const requestHash = JSON.stringify({
      ...normalized,
      ingredientId,
      exactQuantity: exactQuantity ?? null,
      exactUnitId: exactUnitId ?? null,
      expireAt: normalizedExpireAt?.toISOString() ?? null
    });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeItemSummary>(tx, operationId, "fridge:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge:create", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson(normalized));
      const fridgeInput = await this.buildFridgeWriteInput(
        tx,
        userId,
        ingredientId,
        normalized.name,
        normalized.quantityText,
        exactQuantity,
        exactUnitId,
        normalizedExpireAt,
        normalized.note
      );

      const item = await tx.fridgeItem.create({
        data: {
          userId,
          ...fridgeInput
        },
        include: {
          exactUnit: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      await upsertStorageLedger(tx, userId, "FRIDGE", item.id, sizeOfJson(item));
      const result = await this.loadFridgeItemSummaryFromTx(tx, userId, item.id);
      await completeIdempotentOperation(tx, operationId, "fridge:create", userId, null, requestHash, result);
      return result;
    });
  }

  async updateFridgeItem(
    userId: UUID,
    itemId: UUID,
    operationId: OperationId,
    quantityText?: string | null,
    exactQuantity?: string | null,
    exactUnitId?: UUID | null,
    expireAt?: string | null,
    note?: string | null
  ) {
    const normalizedQuantityText = quantityText?.trim() || null;
    const normalizedNote = note?.trim() || null;
    const normalizedExpireAt = this.normalizeExpireAt(expireAt);
    const requestHash = `${itemId}:${JSON.stringify({
      quantityText: normalizedQuantityText,
      exactQuantity: exactQuantity ?? null,
      exactUnitId: exactUnitId ?? null,
      expireAt: normalizedExpireAt?.toISOString() ?? null,
      note: normalizedNote
    })}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeItemSummary>(tx, operationId, "fridge:update", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge:update", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, 0);

      const item = await tx.fridgeItem.findUnique({ where: { id: itemId } });
      if (!item || item.userId !== userId) throw new NotFoundException("食材不存在");
      const fridgeInput = await this.buildFridgeWriteInput(
        tx,
        userId,
        item.ingredientId,
        item.name,
        normalizedQuantityText,
        exactQuantity,
        exactUnitId,
        normalizedExpireAt,
        normalizedNote
      );

      const next = await tx.fridgeItem.update({
        where: { id: itemId },
        data: fridgeInput,
        include: {
          exactUnit: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      await upsertStorageLedger(tx, userId, "FRIDGE", next.id, sizeOfJson(next));
      const result = await this.loadFridgeItemSummaryFromTx(tx, userId, next.id);
      await completeIdempotentOperation(tx, operationId, "fridge:update", userId, null, requestHash, result);
      return result;
    });
  }

  async consumeFridgeItems(userId: UUID, operationId: OperationId, itemIds: UUID[]) {
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

  async getShoppingListSummary(userId: UUID): Promise<ShoppingListSummaryResponse> {
    const memberships = await this.prisma.shoppingListMember.findMany({
      where: { userId },
      select: {
        list: {
          select: {
            status: true
          }
        }
      }
    });
    const statuses: ShoppingListStatusCount[] = [
      { status: "ACTIVE", count: 0 },
      { status: "COMPLETED", count: 0 },
      { status: "VOIDED", count: 0 }
    ];
    for (const membership of memberships) {
      const current = statuses.find(item => item.status === membership.list.status);
      if (current) current.count += 1;
    }
    const defaultStatus = statuses.find(item => item.status === "ACTIVE" && item.count > 0)?.status
      ?? statuses.find(item => item.count > 0)?.status
      ?? "ACTIVE";
    return {
      statuses,
      defaultStatus
    };
  }

  async listShoppingLists(userId: UUID, status?: string): Promise<ShoppingListPageResponse> {
    const normalizedStatus = this.normalizeShoppingListStatus(status);
    const lists = await this.prisma.shoppingList.findMany({
      where: {
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        members: {
          some: {
            userId
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        voidedAt: true,
        owner: {
          select: {
            uid: true,
            nickname: true
          }
        },
        members: {
          where: {
            userId
          },
          select: {
            role: true
          }
        },
        _count: {
          select: {
            members: true,
            invites: {
              where: {
                status: "PENDING"
              }
            }
          }
        },
        shareTokens: {
          where: {
            disabledAt: null
          },
          select: {
            id: true
          }
        },
        items: {
          where: {
            status: {
              not: "DELETED"
            }
          },
          select: {
            ingredientId: true,
            name: true,
            status: true,
            fridgeCovered: true
          }
        }
      }
    });
    return {
      items: await Promise.all(lists.map(list => this.toShoppingListSummary(this.prisma, list)))
    };
  }

  async listShoppingListInvites(userId: UUID, filter?: string): Promise<ShoppingListInvitePageResponse> {
    const inviteFilter = normalizeShoppingListInviteFilter(filter);
    const retainDays = await this.resolveShoppingListInviteMessageDays(this.prisma, userId);
    const cutoffAt = addDays(new Date(), -retainDays);
    const where = this.buildShoppingListInviteWhere(userId, inviteFilter, cutoffAt, filter === undefined);
    const invites = await this.prisma.shoppingListInvite.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
        declinedAt: true,
        list: {
          select: {
            id: true,
            name: true,
            status: true,
            ownerUserId: true,
            owner: {
              select: {
                uid: true,
                nickname: true
              }
            },
            _count: {
              select: {
                members: true,
                items: {
                  where: {
                    status: {
                      not: "DELETED"
                    }
                  }
                }
              }
            },
            members: {
              where: {
                userId
              },
              select: {
                role: true
              }
            }
          }
        }
      }
    });
    const items = await Promise.all(invites.map(invite => this.toShoppingListInviteSummary(this.prisma, invite)));
    return {
      items: items.sort((left, right) => {
        const leftTime = new Date(left.handledAt ?? left.invitedAt).getTime();
        const rightTime = new Date(right.handledAt ?? right.invitedAt).getTime();
        if (leftTime === rightTime) return Number(right.id) - Number(left.id);
        return rightTime - leftTime;
      })
    };
  }

  async createShoppingList(userId: UUID, operationId: OperationId, name: string | null): Promise<ShoppingListDetail> {
    const normalizedName = this.normalizeShoppingListName(name);
    const requestHash = normalizedName;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:create", userId, null, requestHash);
      const list = await this.createShoppingListInTx(tx, userId, userId, normalizedName);
      const result = await this.loadShoppingListDetailFromTx(tx, userId, list.id);
      await completeIdempotentOperation(tx, operationId, "shopping-list:create", userId, null, requestHash, result);
      return result;
    });
  }

  async getShoppingListDetail(userId: UUID, listId: UUID): Promise<ShoppingListDetail> {
    return this.prisma.$transaction(tx => this.loadShoppingListDetailFromTx(tx, userId, listId));
  }

  async renameShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number, name: string): Promise<ShoppingListDetail> {
    const normalizedName = this.normalizeShoppingListName(name);
    const requestHash = `${listId}:${version}:${normalizedName}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:rename", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:rename", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          name: normalizedName,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:rename", userId, null, requestHash, result);
      return result;
    });
  }

  async createShoppingListItem(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    name: string,
    ingredientId: UUID | null,
    quantityText: string | null,
    note: string | null
  ): Promise<ShoppingListDetail> {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const requestHash = `${listId}:${JSON.stringify({ ...normalized, ingredientId })}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:create", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      await this.assertStorageWritable(tx, access.ownerUserId, sizeOfJson(normalized));
      const created = await tx.shoppingItem.create({
        data: {
          userId: access.ownerUserId,
          listId,
          name: normalized.name,
          quantityText: normalized.quantityText,
          baseQuantityText: normalized.quantityText,
          note: normalized.note,
          sourceType: "MANUAL",
          ingredientId
        }
      });
      await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:create", userId, null, requestHash, result);
      return result;
    });
  }

  async addRecipeToShoppingList(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    recipeId: UUID,
    sourceVersionId: UUID,
    planItemId: UUID | null = null
  ): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${recipeId}:${sourceVersionId}:${planItemId ?? 0}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:recipe", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:recipe", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      const source = await this.loadRecipeShoppingSource(tx, userId, recipeId, sourceVersionId);
      if (planItemId) {
        await this.assertPlanShoppingSource(tx, userId, planItemId, recipeId, sourceVersionId);
      }
      const itemSourceType = planItemId ? planSourceType : recipeSourceType;
      const itemSourceKey = planItemId ? String(planItemId) : null;
      const batchKey = String(operationId);
      const sizeBytes = source.ingredients.reduce(
        (total, ingredient, index) =>
          total +
          sizeOfJson({
            userId: access.ownerUserId,
            listId,
            name: ingredient.ingredientName,
            quantityText: formatRecipeAmount(ingredient.amount),
            note: source.title,
            sourceType: itemSourceType,
            sourceKey: itemSourceKey ?? `${source.recipeId}:${source.sourceVersionId}:${batchKey}:${index + 1}`,
            sourceRecipeId: source.recipeId,
            sourceRecipeVersionId: source.sourceVersionId,
            sourceRecipeTitle: source.title,
            sourceBaseServings: source.baseServings,
            sourceBatchKey: batchKey,
            sourceIngredientSort: index + 1,
            ingredientId: ingredient.ingredientId,
            amountJson: ingredient.amount
          }),
        0
      );
      await this.assertStorageWritable(tx, access.ownerUserId, sizeBytes);
      for (const [index, ingredient] of source.ingredients.entries()) {
        const created = await tx.shoppingItem.create({
          data: {
            userId: access.ownerUserId,
            listId,
            name: ingredient.ingredientName,
            quantityText: formatRecipeAmount(ingredient.amount),
            baseQuantityText: formatRecipeAmount(ingredient.amount),
            note: source.title,
            sourceType: itemSourceType,
            sourceKey: itemSourceKey ?? `${source.recipeId}:${source.sourceVersionId}:${batchKey}:${index + 1}`,
            sourceRecipeId: source.recipeId,
            sourceRecipeVersionId: source.sourceVersionId,
            sourceRecipeTitle: source.title,
            sourceBaseServings: source.baseServings,
            sourceBatchKey: batchKey,
            sourceIngredientSort: index + 1,
            ingredientId: ingredient.ingredientId,
            amountJson: ingredient.amount
          }
        });
        await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:recipe", userId, null, requestHash, result);
      return result;
    });
  }

  async addPlanToShoppingList(userId: UUID, listId: UUID, operationId: OperationId, planItemId: UUID): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${planItemId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:plan", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:plan", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      const recipes = await this.readPlanShoppingRecipes(tx, userId, planItemId);
      const sources = await Promise.all(
        recipes.map(item => this.loadRecipeShoppingSource(tx, userId, item.recipeId, item.sourceVersionId, true))
      );
      const batchKey = String(operationId);
      const itemSourceKey = String(planItemId);
      const sizeBytes = sources.reduce(
        (total, source) =>
          total +
          source.ingredients.reduce(
            (innerTotal, ingredient, index) =>
              innerTotal +
              sizeOfJson({
                userId: access.ownerUserId,
                listId,
                name: ingredient.ingredientName,
                quantityText: formatRecipeAmount(ingredient.amount),
                note: source.title,
                sourceType: planSourceType,
                sourceKey: itemSourceKey,
                sourceRecipeId: source.recipeId,
                sourceRecipeVersionId: source.sourceVersionId,
                sourceRecipeTitle: source.title,
                sourceBaseServings: source.baseServings,
                sourceBatchKey: batchKey,
                sourceIngredientSort: index + 1,
                ingredientId: ingredient.ingredientId,
                amountJson: ingredient.amount
              }),
            0
          ),
        0
      );
      await this.assertStorageWritable(tx, access.ownerUserId, sizeBytes);

      for (const source of sources) {
        for (const [index, ingredient] of source.ingredients.entries()) {
          const created = await tx.shoppingItem.create({
          data: {
            userId: access.ownerUserId,
            listId,
            name: ingredient.ingredientName,
            quantityText: formatRecipeAmount(ingredient.amount),
            baseQuantityText: formatRecipeAmount(ingredient.amount),
            note: source.title,
            sourceType: planSourceType,
              sourceKey: itemSourceKey,
              sourceRecipeId: source.recipeId,
              sourceRecipeVersionId: source.sourceVersionId,
              sourceRecipeTitle: source.title,
              sourceBaseServings: source.baseServings,
              sourceBatchKey: batchKey,
              sourceIngredientSort: index + 1,
              ingredientId: ingredient.ingredientId,
              amountJson: ingredient.amount
            }
          });
          await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
        }
      }

      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:plan", userId, null, requestHash, result);
      return result;
    });
  }

  async updateShoppingListItemCheck(
    userId: UUID,
    listId: UUID,
    itemId: UUID,
    operationId: OperationId,
    version: number,
    checked: boolean
  ): Promise<ShoppingListItemPatchResponse> {
    const requestHash = `${listId}:${itemId}:${version}:${checked}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListItemPatchResponse>(tx, operationId, "shopping-list:item:check", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:check", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      const item = await tx.shoppingItem.findFirst({
        where: {
          id: itemId,
          listId
        }
      });
      if (!item) {
        throw new NotFoundException("购物项不存在");
      }
      if (item.status === "DELETED") {
        throw new BadRequestException("当前购物项已移除");
      }
      if (item.fridgeCovered) {
        throw new BadRequestException("当前购物项已由库存覆盖，无需勾选采购");
      }
      await tx.shoppingItem.update({
        where: { id: itemId },
        data: checked
          ? {
              status: "BOUGHT",
              checkedAt: new Date(),
              checkedByUserId: userId
            }
          : {
              status: "OPEN",
              checkedAt: null,
              checkedByUserId: null
            }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListItemPatchFromTx(tx, userId, listId, itemId, null);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:check", userId, null, requestHash, result);
      return result;
    });
  }

  async applyShoppingListItemFridge(
    userId: UUID,
    listId: UUID,
    itemId: UUID,
    operationId: OperationId,
    version: number,
    action: "APPLY" | "UNDO"
  ): Promise<ShoppingListItemPatchResponse> {
    const requestHash = `${listId}:${itemId}:${version}:${action}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListItemPatchResponse>(tx, operationId, "shopping-list:item:fridge", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:fridge", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能调整库存抵扣");
      }
      const item = await tx.shoppingItem.findFirst({
        where: {
          id: itemId,
          listId
        },
        select: shoppingDetailItemSelect
      });
      if (!item) {
        throw new NotFoundException("购物项不存在");
      }
      if (item.status !== "OPEN") {
        throw new BadRequestException("当前购物项不能调整库存抵扣");
      }

      if (action === "UNDO") {
        if (!item.fridgeAppliedQuantityText) {
          throw new BadRequestException("当前购物项还没有应用库存");
        }
        await this.releaseShoppingItemReservations(tx, [itemId], new Date());
        await tx.shoppingItem.update({
          where: { id: itemId },
          data: {
            quantityText: item.baseQuantityText ?? item.quantityText,
            fridgeAppliedQuantityText: null,
            fridgeCovered: false,
            version: { increment: 1 }
          }
        });
      } else {
        if (item.fridgeAppliedQuantityText) {
          throw new BadRequestException("当前购物项已经应用库存");
        }
        const activeReservationCount = await tx.shoppingItemFridgeReservation.count({
          where: {
            shoppingItemId: itemId,
            releasedAt: null,
            settledAt: null
          }
        });
        if (activeReservationCount > 0) {
          throw new BadRequestException("当前购物项已经应用库存");
        }
        const fridgeRows = await this.loadShoppingFridgeRows(tx, access.ownerUserId);
        const reservationPlan = this.buildShoppingItemReservationPlan(item, fridgeRows);
        if (reservationPlan.mode === "NEED_CONFIRM") {
          throw new BadRequestException("当前库存数量还不能自动计算，请先补齐结构化数量");
        }
        if (reservationPlan.mode === "NONE" || !reservationPlan.reservations.length) {
          throw new BadRequestException("当前购物项没有可自动使用的库存");
        }
        await tx.shoppingItemFridgeReservation.createMany({
          data: reservationPlan.reservations.map(current => ({
            userId: access.ownerUserId,
            shoppingListId: listId,
            shoppingItemId: itemId,
            fridgeItemId: current.fridgeItemId,
            reservedQuantity: current.reservedQuantity,
            reservedUnitId: current.reservedUnitId
          }))
        });
        await tx.shoppingItem.update({
          where: { id: itemId },
          data: {
            fridgeAppliedQuantityText: reservationPlan.appliedQuantityText,
            fridgeCovered: reservationPlan.covered,
            version: { increment: 1 }
          }
        });
      }

      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListItemPatchFromTx(tx, userId, listId, itemId, null);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:fridge", userId, null, requestHash, result);
      return result;
    });
  }

  async removeShoppingListItem(
    userId: UUID,
    listId: UUID,
    itemId: UUID,
    operationId: OperationId,
    version: number
  ): Promise<ShoppingListItemPatchResponse> {
    const requestHash = `${listId}:${itemId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListItemPatchResponse>(tx, operationId, "shopping-list:item:remove", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:remove", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      const item = await tx.shoppingItem.findFirst({
        where: {
          id: itemId,
          listId
        }
      });
      if (!item) {
        throw new NotFoundException("购物项不存在");
      }
      await this.releaseShoppingItemReservations(tx, [itemId], new Date());
      await tx.shoppingItem.update({
        where: { id: itemId },
        data: {
          status: "DELETED",
          removedAt: new Date(),
          removedByUserId: userId
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListItemPatchFromTx(tx, userId, listId, null, itemId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:remove", userId, null, requestHash, result);
      return result;
    });
  }

  async voidShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:void", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:void", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能作废");
      }
      await this.releaseShoppingListReservationsAndRestoreItems(tx, listId, new Date());
      await this.closeShoppingShareInTx(tx, listId);
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          completedAt: null,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:void", userId, null, requestHash, result);
      return result;
    });
  }

  async checkAllShoppingListItems(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:check-all", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:check-all", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能标记完成");
      }
      const now = new Date();
      await tx.shoppingItem.updateMany({
        where: {
          listId,
          fridgeCovered: false,
          status: {
            not: "DELETED"
          }
        },
        data: {
          status: "BOUGHT",
          checkedAt: now,
          checkedByUserId: userId
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:check-all", userId, null, requestHash, result);
      return result;
    });
  }

  async restoreShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:restore", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:restore", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "VOIDED") {
        throw new BadRequestException("当前清单不能恢复");
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          status: "ACTIVE",
          voidedAt: null,
          completedAt: null,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:restore", userId, null, requestHash, result);
      return result;
    });
  }

  async copyShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:copy", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:copy", userId, null, requestHash);
      const access = await this.assertShoppingListReadable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      const sourceItems = await tx.shoppingItem.findMany({
        where: {
          listId,
          status: {
            not: "DELETED"
          }
        },
        orderBy: [{ id: "asc" }]
      });
      const targetList = await this.createShoppingListInTx(tx, userId, userId, `${access.name} - 再次采购`);
      const sizeBytes = sourceItems.reduce((total, item) => total + sizeOfJson(item), 0);
      await this.assertStorageWritable(tx, userId, sizeBytes);
      for (const item of sourceItems) {
        const sourceFields = item.sourceType === "RECIPE" || item.sourceType === "PLAN"
          ? {
              sourceRecipeId: item.sourceRecipeId,
              sourceRecipeVersionId: item.sourceRecipeVersionId,
              sourceRecipeTitle: item.sourceRecipeTitle,
              sourceBaseServings: item.sourceBaseServings,
              sourceBatchKey: item.sourceBatchKey,
              sourceIngredientSort: item.sourceIngredientSort,
              ingredientId: item.ingredientId,
              amountJson: item.amountJson as Prisma.InputJsonValue
            }
          : item.sourceType === "MANUAL"
            ? {
                sourceRecipeId: null,
                sourceRecipeVersionId: null,
                sourceRecipeTitle: null,
                sourceBaseServings: null,
                sourceBatchKey: null,
                sourceIngredientSort: null,
                ingredientId: item.ingredientId,
                amountJson: Prisma.DbNull
              }
          : {
              sourceRecipeId: null,
              sourceRecipeVersionId: null,
              sourceRecipeTitle: null,
              sourceBaseServings: null,
              sourceBatchKey: null,
              sourceIngredientSort: null,
              ingredientId: null,
              amountJson: Prisma.DbNull
            };
        const created = await tx.shoppingItem.create({
          data: {
            userId,
            listId: targetList.id,
            name: item.name,
            quantityText: item.quantityText,
            baseQuantityText: item.baseQuantityText,
            fridgeAppliedQuantityText: null,
            note: item.note,
            sourceType: item.sourceType,
            sourceKey: item.sourceKey,
            ...sourceFields,
            fridgeCovered: false,
            status: "OPEN",
            checkedAt: null,
            checkedByUserId: null,
            removedAt: null,
            removedByUserId: null
          }
        });
        await upsertStorageLedger(tx, userId, "SHOPPING", created.id, sizeOfJson(created));
      }
      const result = await this.loadShoppingListDetailFromTx(tx, userId, targetList.id);
      await completeIdempotentOperation(tx, operationId, "shopping-list:copy", userId, null, requestHash, result);
      return result;
    });
  }

  async deleteShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListPageResponse> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListPageResponse>(tx, operationId, "shopping-list:delete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:delete", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "COMPLETED" && access.status !== "VOIDED") {
        throw new BadRequestException("当前清单状态不支持删除");
      }

      const itemIds = (
        await tx.shoppingItem.findMany({
          where: { listId },
          select: { id: true }
        })
      ).map(item => item.id);

      if (itemIds.length) {
        await tx.storageLedger.deleteMany({
          where: {
            userId: access.ownerUserId,
            module: "SHOPPING",
            recordKey: {
              in: itemIds.map(itemId => String(itemId))
            }
          }
        });
        await tx.shoppingItem.deleteMany({
          where: { listId }
        });
      }

      await tx.shoppingList.delete({
        where: { id: listId }
      });

      const result = await this.loadShoppingListPageFromTx(tx, userId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:delete", userId, null, requestHash, result);
      return result;
    });
  }

  async completeShoppingList(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    version: number,
    entries: CompleteShoppingListEntryRequest[]
  ): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}:${JSON.stringify(entries)}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:complete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:complete", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能完成");
      }
      const checkedItems = await tx.shoppingItem.findMany({
        where: {
          listId,
          status: "BOUGHT"
        }
      });
      const checkedMap = new Map(checkedItems.map(item => [item.id, item]));
      for (const entry of entries) {
        const item = checkedMap.get(entry.itemId);
        if (!item) {
          throw new BadRequestException("入库项必须来自当前已勾选的购物项");
        }
      }
      let expectedDeltaBytes = 0;
      const now = new Date();
      for (const entry of entries) {
        if (!entry.store) continue;
        const item = checkedMap.get(entry.itemId)!;
        const expireAt = entry.expireAt ? new Date(entry.expireAt) : addDays(now, entry.expireDays ?? 7);
        const customQuantityText = entry.quantityText?.trim() || null;
        const quantities = this.resolveShoppingItemQuantities(item);
        const storedQuantityText = customQuantityText || quantities.remainingQuantityText || quantities.requiredQuantityText;
        const exactAmount = this.readShoppingItemExactAmount(item.amountJson);
        const exactQuantity = exactAmount
          ? customQuantityText
            ? this.parseExactQuantityByUnit(customQuantityText, exactAmount.unitName)
            : quantities.remainingQuantityText
              ? this.parseExactQuantityByUnit(quantities.remainingQuantityText, exactAmount.unitName)
              : null
          : null;
        expectedDeltaBytes += sizeOfJson({
          userId: access.ownerUserId,
          ingredientId: item.ingredientId,
          sourceShoppingListId: listId,
          sourceShoppingItemId: item.id,
          name: item.name,
          quantityText: exactAmount && exactQuantity !== null ? this.formatExactQuantityText(exactQuantity, exactAmount.unitName) : storedQuantityText,
          exactQuantity,
          exactUnitId: exactAmount && exactQuantity !== null ? exactAmount.unitId : null,
          note: item.note,
          available: true,
          expireAt
        });
      }
      await this.assertStorageWritable(tx, access.ownerUserId, expectedDeltaBytes);
      await this.settleShoppingListReservations(tx, listId, now);
      for (const entry of entries) {
        if (!entry.store) continue;
        const item = checkedMap.get(entry.itemId)!;
        const expireAt = entry.expireAt ? new Date(entry.expireAt) : addDays(now, entry.expireDays ?? 7);
        const customQuantityText = entry.quantityText?.trim() || null;
        const quantities = this.resolveShoppingItemQuantities(item);
        const storedQuantityText = customQuantityText || quantities.remainingQuantityText || quantities.requiredQuantityText;
        const exactAmount = this.readShoppingItemExactAmount(item.amountJson);
        const exactQuantity = exactAmount
          ? customQuantityText
            ? this.parseExactQuantityByUnit(customQuantityText, exactAmount.unitName)
            : quantities.remainingQuantityText
              ? this.parseExactQuantityByUnit(quantities.remainingQuantityText, exactAmount.unitName)
              : null
          : null;
        const created = await tx.fridgeItem.create({
          data: {
            userId: access.ownerUserId,
            ingredientId: item.ingredientId,
            sourceShoppingListId: listId,
            sourceShoppingItemId: item.id,
            name: item.name,
            quantityText: exactAmount && exactQuantity !== null ? this.formatExactQuantityText(exactQuantity, exactAmount.unitName) : storedQuantityText,
            exactQuantity,
            exactUnitId: exactAmount && exactQuantity !== null ? exactAmount.unitId : null,
            note: item.note,
            expireAt
          }
        });
        await upsertStorageLedger(tx, access.ownerUserId, "FRIDGE", created.id, sizeOfJson(created));
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          voidedAt: null,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:complete", userId, null, requestHash, result);
      return result;
    });
  }

  async createShoppingListShareLink(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShareShoppingListLinkResponse> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShareShoppingListLinkResponse>(tx, operationId, "shopping-list:share-link", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-link", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能继续共享");
      }
      await tx.shoppingShareToken.updateMany({
        where: {
          listId,
          disabledAt: null
        },
        data: {
          disabledAt: new Date()
        }
      });
      const shareToken = randomBytes(24).toString("hex");
      await tx.shoppingShareToken.create({
        data: {
          listId,
          token: shareToken,
          createdByUserId: userId
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = {
        shareToken,
        shareUrl: `/pages_pantry/list/index?shareToken=${shareToken}`
      };
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-link", userId, null, requestHash, result);
      return result;
    });
  }

  async closeShoppingListShare(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-close", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-close", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能关闭共享");
      }
      await this.closeShoppingShareInTx(tx, listId);
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-close", userId, null, requestHash, result);
      return result;
    });
  }

  async disableShoppingListShareLink(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-disable", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-disable", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      await tx.shoppingShareToken.updateMany({
        where: {
          listId,
          disabledAt: null
        },
        data: {
          disabledAt: new Date()
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-disable", userId, null, requestHash, result);
      return result;
    });
  }

  async shareShoppingListMembers(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    version: number,
    targetUserIds: UUID[]
  ): Promise<ShoppingListDetail> {
    const uniqueUserIds = Array.from(new Set(targetUserIds.filter(id => id !== userId)));
    const requestHash = `${listId}:${version}:${uniqueUserIds.join(",")}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-members", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-members", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能继续共享");
      }
      await this.assertShareableDiningGroupUsers(tx, userId, uniqueUserIds);
      const currentMembers = await tx.shoppingListMember.findMany({
        where: { listId },
        select: { userId: true }
      });
      const memberIds = new Set(currentMembers.map(item => item.userId));
      const nextInviteUserIds = uniqueUserIds.filter(targetUserId => !memberIds.has(targetUserId));
      await this.assertShoppingListInviteCapacity(tx, access.ownerUserId, currentMembers.length, nextInviteUserIds.length);
      for (const targetUserId of nextInviteUserIds) {
        await tx.shoppingListInvite.upsert({
          where: {
            listId_targetUserId: {
              listId,
              targetUserId
            }
          },
          create: {
            listId,
            targetUserId,
            createdByUserId: userId,
            status: "PENDING"
          },
          update: {
            createdByUserId: userId,
            acceptedByUserId: null,
            status: "PENDING",
            acceptedAt: null,
            declinedAt: null,
            revokedAt: null
          }
        });
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-members", userId, null, requestHash, result);
      return result;
    });
  }

  async removeShoppingListMember(
    userId: UUID,
    listId: UUID,
    memberUserId: UUID,
    operationId: OperationId,
    version: number
  ): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${memberUserId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:member:remove", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:member:remove", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能调整协作者");
      }
      if (memberUserId === access.ownerUserId || memberUserId === userId) {
        throw new BadRequestException("当前成员不能通过这里移除");
      }
      const member = await tx.shoppingListMember.findUnique({
        where: {
          listId_userId: {
            listId,
            userId: memberUserId
          }
        },
        select: {
          role: true
        }
      });
      if (!member) {
        throw new NotFoundException("协作者不存在");
      }
      if (member.role !== "COLLABORATOR") {
        throw new BadRequestException("当前成员不能通过这里移除");
      }
      await tx.shoppingListMember.delete({
        where: {
          listId_userId: {
            listId,
            userId: memberUserId
          }
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:member:remove", userId, null, requestHash, result);
      return result;
    });
  }

  async acceptShoppingListInvite(userId: UUID, inviteId: UUID, operationId: OperationId): Promise<ShoppingListDetail> {
    const requestHash = String(inviteId);
    const invite = await this.prisma.shoppingListInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        listId: true,
        targetUserId: true
      }
    });
    if (!invite || invite.targetUserId !== userId) {
      throw new NotFoundException("邀请不存在");
    }
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "shopping_list_invites" WHERE "id" = ${inviteId} FOR UPDATE`;
      const currentInvite = await tx.shoppingListInvite.findUnique({
        where: { id: inviteId },
        include: {
          list: {
            select: {
              id: true,
              ownerUserId: true,
              status: true
            }
          }
        }
      });
      if (!currentInvite || currentInvite.targetUserId !== userId) {
        throw new NotFoundException("邀请不存在");
      }
      const existing = await tx.shoppingListMember.findUnique({
        where: {
          listId_userId: {
            listId: currentInvite.listId,
            userId
          }
        }
      });
      if (existing) {
        if (currentInvite.status !== "ACCEPTED") {
          await tx.shoppingListInvite.update({
            where: { id: inviteId },
            data: {
              status: "ACCEPTED",
              acceptedByUserId: userId,
              acceptedAt: new Date(),
              declinedAt: null,
              revokedAt: null
            }
          });
        }
        const result = await this.loadShoppingListDetailFromTx(tx, userId, currentInvite.listId);
        await completeIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash, result);
        return result;
      }
      if (currentInvite.status === "ACCEPTED") {
        const result = await this.loadShoppingListDetailFromTx(tx, userId, currentInvite.listId);
        await completeIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash, result);
        return result;
      }
      if (currentInvite.status !== "PENDING") {
        throw new BadRequestException("邀请已失效");
      }
      if (currentInvite.list.status !== "ACTIVE") {
        throw new BadRequestException("当前清单暂不支持继续加入");
      }
      await this.assertShoppingListMemberCapacity(tx, currentInvite.listId, currentInvite.list.ownerUserId, [userId]);
      await tx.shoppingListMember.create({
        data: {
          listId: currentInvite.listId,
          userId,
          role: "COLLABORATOR",
          addedByUserId: currentInvite.createdByUserId
        }
      });
      await tx.shoppingListInvite.update({
        where: { id: inviteId },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: userId,
          acceptedAt: new Date(),
          declinedAt: null,
          revokedAt: null
        }
      });
      await tx.shoppingList.update({
        where: { id: currentInvite.listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, currentInvite.listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash, result);
      return result;
    });
  }

  async declineShoppingListInvite(userId: UUID, inviteId: UUID, operationId: OperationId): Promise<ShoppingListInviteActionResponse> {
    const requestHash = String(inviteId);
    const invite = await this.prisma.shoppingListInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        listId: true,
        targetUserId: true
      }
    });
    if (!invite || invite.targetUserId !== userId) {
      throw new NotFoundException("邀请不存在");
    }
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListInviteActionResponse>(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash);
      const currentInvite = await tx.shoppingListInvite.findUnique({
        where: { id: inviteId }
      });
      if (!currentInvite || currentInvite.targetUserId !== userId) {
        throw new NotFoundException("邀请不存在");
      }
      if (currentInvite.status === "DECLINED") {
        const result = {
          inviteId: currentInvite.id,
          status: currentInvite.status,
          updatedAt: toIsoDate(currentInvite.updatedAt)
        } satisfies ShoppingListInviteActionResponse;
        await completeIdempotentOperation(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash, result);
        return result;
      }
      if (currentInvite.status !== "PENDING") {
        throw new BadRequestException("邀请已失效");
      }
      const nextInvite = await tx.shoppingListInvite.update({
        where: { id: inviteId },
        data: {
          status: "DECLINED",
          declinedAt: new Date()
        }
      });
      const result = {
        inviteId: nextInvite.id,
        status: nextInvite.status,
        updatedAt: toIsoDate(nextInvite.updatedAt)
      } satisfies ShoppingListInviteActionResponse;
      await completeIdempotentOperation(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash, result);
      return result;
    });
  }

  async leaveShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListPageResponse> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListPageResponse>(tx, operationId, "shopping-list:leave", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:leave", userId, null, requestHash);
      const access = await this.assertShoppingListReadable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.role !== "COLLABORATOR") {
        throw new BadRequestException("创建者不能退出自己创建的清单");
      }
      await tx.shoppingListMember.delete({
        where: {
          listId_userId: {
            listId,
            userId
          }
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const items = await this.loadShoppingListPageFromTx(tx, userId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:leave", userId, null, requestHash, items);
      return items;
    });
  }

  async getShoppingSharePreview(userId: UUID, shareToken: string): Promise<ShoppingSharePreview> {
    return this.prisma.$transaction(async tx => {
      const token = await tx.shoppingShareToken.findFirst({
        where: {
          token: shareToken,
          disabledAt: null
        },
        select: {
          list: {
            select: {
              id: true,
              name: true,
              status: true,
              owner: {
                select: {
                  id: true,
                  uid: true,
                  nickname: true
                }
              },
              _count: {
                select: {
                  members: true,
                  items: true
                }
              },
              members: {
                where: {
                  userId
                },
                select: {
                  role: true
                }
              }
            }
          }
        }
      });
      if (!token) {
        throw new NotFoundException("分享链接不存在");
      }
      const memberLimit = await this.resolveShoppingListMemberLimit(tx, token.list.owner.id);
      const joined = token.list.members.length > 0;
      const canJoin = joined || (token.list.status === "ACTIVE" && token.list._count.members < memberLimit);
      return {
        listId: token.list.id,
        name: token.list.name,
        ownerUid: token.list.owner.uid,
        ownerNickname: token.list.owner.nickname,
        memberCount: token.list._count.members,
        memberLimit,
        joined,
        canJoin,
        itemCount: token.list._count.items,
        status: token.list.status
      };
    });
  }

  async joinShoppingShare(userId: UUID, shareToken: string, operationId: OperationId): Promise<ShoppingListDetail> {
    const requestHash = shareToken;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-join", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-join", userId, null, requestHash);
      const token = await tx.shoppingShareToken.findFirst({
        where: {
          token: shareToken,
          disabledAt: null
        },
        select: {
          listId: true
        }
      });
      if (!token) {
        throw new NotFoundException("分享链接不存在");
      }
      const list = await tx.shoppingList.findUnique({
        where: { id: token.listId },
        select: {
          id: true,
          ownerUserId: true,
          status: true
        }
      });
      if (!list) {
        throw new NotFoundException("分享链接不存在");
      }
      if (list.status !== "ACTIVE") {
        throw new BadRequestException("当前清单暂不支持继续加入");
      }
      const existing = await tx.shoppingListMember.findUnique({
        where: {
          listId_userId: {
            listId: token.listId,
            userId
          }
        },
        select: { role: true }
      });
      if (!existing) {
        await this.assertShoppingListMemberCapacity(tx, token.listId, list.ownerUserId, [userId]);
        await tx.shoppingListMember.create({
          data: {
            listId: token.listId,
            userId,
            role: "COLLABORATOR",
            addedByUserId: userId
          }
        });
        await tx.shoppingList.update({
          where: { id: token.listId },
          data: {
            version: { increment: 1 }
          }
        });
      }
      await tx.shoppingListInvite.updateMany({
        where: {
          listId: token.listId,
          targetUserId: userId,
          status: "PENDING"
        },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: userId,
          acceptedAt: new Date(),
          declinedAt: null,
          revokedAt: null
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, token.listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-join", userId, null, requestHash, result);
      return result;
    });
  }

  async getShoppingBoard(userId: UUID): Promise<ShoppingBoardResponse> {
    const items = await this.prisma.shoppingItem.findMany({
      where: {
        userId,
        status: "OPEN"
      },
      select: shoppingRowSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });
    return this.buildShoppingBoard(items.map(this.toShoppingRow));
  }

  async createShoppingItem(userId: UUID, operationId: OperationId, name: string, quantityText?: string | null, note?: string | null) {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const requestHash = JSON.stringify(normalized);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingItemSummary>(tx, operationId, "shopping:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:create", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson(normalized));
      const listId = await this.resolveLegacyTargetListId(tx, userId);
      const item = await tx.shoppingItem.create({
        data: {
          userId,
          listId,
          name: normalized.name,
          quantityText: normalized.quantityText,
          note: normalized.note,
          sourceType: "MANUAL"
        }
      });
      await upsertStorageLedger(tx, userId, "SHOPPING", item.id, sizeOfJson(item));
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = this.toShoppingItemSummary(item);
      await completeIdempotentOperation(tx, operationId, "shopping:create", userId, null, requestHash, result);
      return result;
    });
  }

  async createRecipeShoppingItems(userId: UUID, operationId: OperationId, recipeId: UUID, sourceVersionId: UUID) {
    const requestHash = `${recipeId}:${sourceVersionId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingBoardResponse>(tx, operationId, "shopping:create:recipe", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:create:recipe", userId, null, requestHash);

      const source = await this.loadRecipeShoppingSource(tx, userId, recipeId, sourceVersionId);
      const batchKey = String(operationId);
      const listId = await this.resolveLegacyTargetListId(tx, userId);
      const sizeBytes = source.ingredients.reduce(
        (total, ingredient, index) =>
          total +
          sizeOfJson({
            userId,
            listId,
            name: ingredient.ingredientName,
            quantityText: formatRecipeAmount(ingredient.amount),
            note: `${source.title} · 第${index + 1}项食材`,
            sourceType: "RECIPE",
            sourceKey: `${source.recipeId}:${source.sourceVersionId}:${batchKey}:${index + 1}`,
            sourceRecipeId: source.recipeId,
            sourceRecipeVersionId: source.sourceVersionId,
            sourceRecipeTitle: source.title,
            sourceBaseServings: source.baseServings,
            sourceBatchKey: batchKey,
            sourceIngredientSort: index + 1,
            ingredientId: ingredient.ingredientId,
            amountJson: ingredient.amount
          }),
        0
      );
      await this.assertStorageWritable(tx, userId, sizeBytes);

      const created = await Promise.all(
        source.ingredients.map((ingredient, index) =>
          tx.shoppingItem.create({
            data: {
              userId,
              listId,
              name: ingredient.ingredientName,
              quantityText: formatRecipeAmount(ingredient.amount),
              note: source.title,
              sourceType: recipeSourceType,
              sourceKey: `${source.recipeId}:${source.sourceVersionId}:${batchKey}:${index + 1}`,
              sourceRecipeId: source.recipeId,
              sourceRecipeVersionId: source.sourceVersionId,
              sourceRecipeTitle: source.title,
              sourceBaseServings: source.baseServings,
              sourceBatchKey: batchKey,
              sourceIngredientSort: index + 1,
              ingredientId: ingredient.ingredientId,
              amountJson: ingredient.amount
            }
          })
        )
      );

      for (const item of created) {
        await upsertStorageLedger(tx, userId, "SHOPPING", item.id, sizeOfJson(item));
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });

      const board = await this.loadShoppingBoardFromTx(tx, userId);
      await completeIdempotentOperation(tx, operationId, "shopping:create:recipe", userId, null, requestHash, board);
      return board;
    });
  }

  async createRandomMenuShoppingItems(
    userId: UUID,
    operationId: OperationId,
    items: CreateRandomMenuShoppingItemRequest[]
  ): Promise<ShoppingItemSummary[]> {
    if (!items.length) {
      throw new BadRequestException("当前缺口不能为空");
    }
    const normalizedItems = items.map(item => ({
      slotId: item.slotId.trim(),
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId,
      ingredients: item.ingredients.map(ingredient => ({
        ingredientId: ingredient.ingredientId ?? null,
        ingredientName: ingredient.ingredientName.trim(),
        quantityText: ingredient.quantityText?.trim() || null
      }))
    }));
    const ingredientTotal = normalizedItems.reduce((sum, item) => sum + item.ingredients.length, 0);
    if (ingredientTotal < 1 || ingredientTotal > 80) {
      throw new BadRequestException("缺口食材数量参数错误");
    }
    if (normalizedItems.some(item => !item.slotId || item.ingredients.some(ingredient => !ingredient.ingredientName))) {
      throw new BadRequestException("缺口食材参数错误");
    }

    const requestHash = JSON.stringify(normalizedItems);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingItemSummary[]>(
        tx,
        operationId,
        "shopping:create:random-menu",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:create:random-menu", userId, null, requestHash);

      const recipes = await tx.recipe.findMany({
        where: {
          id: { in: normalizedItems.map(item => item.recipeId) },
          ownerId: userId,
          status: "ACTIVE"
        },
        select: {
          id: true,
          title: true,
          currentVersionId: true
        }
      });
      const recipeMap = new Map(recipes.map(item => [item.id, item]));
      normalizedItems.forEach(item => {
        const recipe = recipeMap.get(item.recipeId);
        if (!recipe || recipe.currentVersionId !== item.recipeVersionId) {
          throw new NotFoundException("菜谱不存在");
        }
      });

      const listId = await this.resolveLegacyTargetListId(tx, userId);
      const batchKey = String(operationId);
      const sizeBytes = normalizedItems.reduce((sum, item) => {
        const recipe = recipeMap.get(item.recipeId)!;
        return (
          sum +
          item.ingredients.reduce(
            (innerSum, ingredient, index) =>
              innerSum +
              sizeOfJson({
                userId,
                listId,
                name: ingredient.ingredientName,
                quantityText: ingredient.quantityText,
                note: recipe.title,
                sourceType: "RANDOM_MENU",
                sourceKey: `${item.recipeId}:${item.recipeVersionId}:${batchKey}:${item.slotId}:${index + 1}`,
                sourceRecipeId: null,
                sourceRecipeVersionId: null,
                sourceRecipeTitle: null,
                sourceBaseServings: null,
                sourceBatchKey: null,
                sourceIngredientSort: null,
                ingredientId: null,
                amountJson: null
              }),
            0
          )
        );
      }, 0);
      await this.assertStorageWritable(tx, userId, sizeBytes);

      const results: ShoppingItemSummary[] = [];
      for (const item of normalizedItems) {
        const recipe = recipeMap.get(item.recipeId)!;
        for (let index = 0; index < item.ingredients.length; index += 1) {
          const ingredient = item.ingredients[index]!;
          const sourceKey = `${item.recipeId}:${item.recipeVersionId}:${batchKey}:${item.slotId}:${index + 1}`;
          const existing = await tx.shoppingItem.findFirst({
            where: {
              userId,
              sourceType: "RANDOM_MENU",
              sourceKey,
              status: "OPEN"
            }
          });
          const next =
            existing ??
            (await tx.shoppingItem.create({
              data: {
                userId,
                listId,
                name: ingredient.ingredientName,
                quantityText: ingredient.quantityText,
                note: recipe.title,
                sourceType: "RANDOM_MENU",
                sourceKey
              }
            }));
          if (!existing) {
            await upsertStorageLedger(tx, userId, "SHOPPING", next.id, sizeOfJson(next));
          }
          results.push({
            ...this.toShoppingItemSummary(next),
            sourceTitles: [recipe.title]
          });
        }
      }

      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });

      await completeIdempotentOperation(tx, operationId, "shopping:create:random-menu", userId, null, requestHash, results);
      return results;
    });
  }

  async updateShoppingStatus(userId: UUID, itemId: UUID, operationId: OperationId, status: string) {
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
          status: normalizedStatus,
          checkedAt: normalizedStatus === "BOUGHT" ? new Date() : null,
          checkedByUserId: normalizedStatus === "BOUGHT" ? userId : null,
          removedAt: normalizedStatus === "DELETED" ? new Date() : null,
          removedByUserId: normalizedStatus === "DELETED" ? userId : null
        }
      });

      if (normalizedStatus === "DELETED") {
        await removeStorageLedger(tx, userId, "SHOPPING", itemId);
      } else {
        await upsertStorageLedger(tx, userId, "SHOPPING", itemId, sizeOfJson(next));
      }
      if (item.listId) {
        await tx.shoppingList.update({
          where: { id: item.listId },
          data: {
            version: { increment: 1 }
          }
        });
      }

      const result = this.toShoppingItemSummary(next);
      await completeIdempotentOperation(tx, operationId, "shopping:status", userId, null, requestHash, result);
      return result;
    });
  }

  async updateShoppingGroupStatus(userId: UUID, operationId: OperationId, targetKey: string, status: string) {
    const normalizedStatus = normalizeShoppingStatus(status);
    const requestHash = `${targetKey}:${normalizedStatus}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingBoardResponse>(tx, operationId, "shopping:group:status", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:group:status", userId, null, requestHash);

      const targetWhere = this.resolveShoppingGroupWhere(userId, targetKey);
      const items = await tx.shoppingItem.findMany({
        where: targetWhere,
        select: {
          id: true,
          userId: true
        }
      });
      if (!items.length) {
        throw new NotFoundException("购物项不存在");
      }

      await tx.shoppingItem.updateMany({
        where: {
          id: { in: items.map(item => item.id) }
        },
        data: {
          status: normalizedStatus,
          checkedAt: normalizedStatus === "BOUGHT" ? new Date() : null,
          checkedByUserId: normalizedStatus === "BOUGHT" ? userId : null,
          removedAt: normalizedStatus === "DELETED" ? new Date() : null,
          removedByUserId: normalizedStatus === "DELETED" ? userId : null
        }
      });

      if (normalizedStatus === "DELETED") {
        for (const item of items) {
          await removeStorageLedger(tx, userId, "SHOPPING", item.id);
        }
      } else {
        const updated = await tx.shoppingItem.findMany({
          where: {
            id: { in: items.map(item => item.id) }
          }
        });
        for (const item of updated) {
          await upsertStorageLedger(tx, userId, "SHOPPING", item.id, sizeOfJson(item));
        }
      }
      const listIds = await tx.shoppingItem.findMany({
        where: {
          id: { in: items.map(item => item.id) },
          listId: { not: null }
        },
        select: {
          listId: true
        },
        distinct: ["listId"]
      });
      for (const item of listIds) {
        if (!item.listId) continue;
        await tx.shoppingList.update({
          where: { id: item.listId },
          data: {
            version: { increment: 1 }
          }
        });
      }

      const board = await this.loadShoppingBoardFromTx(tx, userId);
      await completeIdempotentOperation(tx, operationId, "shopping:group:status", userId, null, requestHash, board);
      return board;
    });
  }

  async previewGap(userId: UUID): Promise<ShoppingItemSummary[]> {
    const [events, fridgeItems] = await Promise.all([
      this.prisma.diningEvent.findMany({
        where: {
          userId,
          status: {
            in: ["PLANNED", "CONFIRMED"]
          }
        },
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          updatedAt: true,
          menuSnapshot: true
        }
      }),
      this.prisma.fridgeItem.findMany({
        where: {
          userId,
          available: true
        }
      })
    ]);

    return this.buildGapSummary(events, fridgeItems, "ALL");
  }

  async previewEventGap(userId: UUID, eventId: UUID): Promise<ShoppingItemSummary[]> {
    const [event, fridgeItems] = await Promise.all([
      this.prisma.diningEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          menuSnapshot: true,
          userId: true
        }
      }),
      this.prisma.fridgeItem.findMany({
        where: {
          userId,
          available: true
        }
      })
    ]);
    if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
    return this.buildGapSummary([event], fridgeItems, "EVENT");
  }

  async createEventGap(userId: UUID, eventId: UUID, operationId: OperationId) {
    const requestHash = String(eventId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingItemSummary[]>(tx, operationId, "shopping:gap", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping:gap", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, 0);

      const preview = await this.previewEventGap(userId, eventId);
      const listId = await this.resolveLegacyTargetListId(tx, userId);
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
          results.push({
            ...this.toShoppingItemSummary(existing),
            sourceCount: item.sourceCount,
            sourceTitles: item.sourceTitles
          });
          continue;
        }

        const created = await tx.shoppingItem.create({
          data: {
            userId,
            listId,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: "EVENT",
            sourceKey: item.sourceKey
          }
        });
        await upsertStorageLedger(tx, userId, "SHOPPING", created.id, sizeOfJson(created));
        results.push({
          ...this.toShoppingItemSummary(created),
          sourceCount: item.sourceCount,
          sourceTitles: item.sourceTitles
        });
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });

      await completeIdempotentOperation(tx, operationId, "shopping:gap", userId, null, requestHash, results);
      return results;
    });
  }

  private normalizeShoppingListStatus(value?: string) {
    if (!value) return null;
    if (value !== "ACTIVE" && value !== "COMPLETED" && value !== "VOIDED") {
      throw new BadRequestException("购物清单状态参数错误");
    }
    return value;
  }

  private normalizeShoppingListName(value: string | null | undefined) {
    const normalized = value?.trim() ?? "";
    if (!normalized) return "新清单";
    if (normalized.length > 20) {
      throw new BadRequestException("清单名称过长");
    }
    return normalized;
  }

  private assertShoppingListVersion(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) {
      throw new ConflictException("清单已被他人更新，请刷新后重试");
    }
  }

  private async createShoppingListInTx(
    tx: Prisma.TransactionClient,
    ownerUserId: UUID,
    addedByUserId: UUID,
    name: string
  ) {
    const list = await tx.shoppingList.create({
      data: {
        ownerUserId,
        name,
        members: {
          create: {
            userId: ownerUserId,
            role: "OWNER",
            addedByUserId
          }
        }
      }
    });
    return list;
  }

  private async resolveLegacyTargetListId(tx: Prisma.TransactionClient, userId: UUID) {
    const existing = await tx.shoppingList.findFirst({
      where: {
        ownerUserId: userId,
        status: "ACTIVE"
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true
      }
    });
    if (existing) return existing.id;
    const created = await this.createShoppingListInTx(tx, userId, userId, "旧待买清单");
    return created.id;
  }

  private async assertShoppingListReadable(tx: Prisma.TransactionClient, userId: UUID, listId: UUID) {
    const list = await tx.shoppingList.findFirst({
      where: {
        id: listId,
        members: {
          some: {
            userId
          }
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
        ownerUserId: true,
        members: {
          where: {
            userId
          },
          select: {
            role: true
          }
        }
      }
    });
    if (!list || !list.members.length) {
      throw new NotFoundException("购物清单不存在");
    }
    return {
      id: list.id,
      name: list.name,
      status: list.status,
      version: list.version,
      ownerUserId: list.ownerUserId,
      role: list.members[0].role
    };
  }

  private async assertShoppingListOwner(tx: Prisma.TransactionClient, userId: UUID, listId: UUID) {
    const access = await this.assertShoppingListReadable(tx, userId, listId);
    if (access.role !== "OWNER") {
      throw new ForbiddenException("只有创建者可以执行该操作");
    }
    return access;
  }

  private async assertShoppingListWritable(tx: Prisma.TransactionClient, userId: UUID, listId: UUID) {
    const access = await this.assertShoppingListReadable(tx, userId, listId);
    if (access.status !== "ACTIVE") {
      throw new BadRequestException("当前清单不是采购中状态");
    }
    return access;
  }

  private async loadShoppingListItemPatchFromTx(
    tx: Prisma.TransactionClient,
    userId: UUID,
    listId: UUID,
    changedItemId: UUID | null,
    removedItemId: UUID | null
  ): Promise<ShoppingListItemPatchResponse> {
    const access = await this.assertShoppingListReadable(tx, userId, listId);
    const canUseFridgeAction = access.role === "OWNER" && access.status === "ACTIVE";
    const [items, fridgeRows] = await Promise.all([
      changedItemId === null
        ? Promise.resolve([] as ShoppingDetailItemRow[])
        : tx.shoppingItem.findMany({
            where: {
              listId,
              status: {
                not: "DELETED"
              }
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: shoppingDetailItemSelect
          }),
      changedItemId !== null && canUseFridgeAction
        ? this.loadShoppingFridgeRows(tx, access.ownerUserId)
        : Promise.resolve([] as FridgeMatchRow[])
    ]);
    if (changedItemId !== null && !items.some(item => item.id === changedItemId)) {
      throw new NotFoundException("购物项不存在");
    }
    const itemMap = changedItemId === null
      ? null
      : this.buildShoppingListDetailItemMap(items, fridgeRows, canUseFridgeAction);
    const progress = this.buildShoppingListProgress(items);
    return {
      listId,
      version: access.version,
      progressDoneCount: progress.progressDoneCount,
      progressTotalCount: progress.progressTotalCount,
      item: changedItemId === null ? null : itemMap?.get(changedItemId) ?? null,
      removedItemId
    };
  }

  private async loadShoppingFridgeRows(tx: Prisma.TransactionClient, userId: UUID): Promise<FridgeMatchRow[]> {
    const [fridgeItems, reservations] = await Promise.all([
      tx.fridgeItem.findMany({
        where: {
          userId,
          available: true
        },
        orderBy: [{ id: "asc" }],
        select: {
          id: true,
          ingredientId: true,
          name: true,
          quantityText: true,
          exactQuantity: true,
          exactUnitId: true,
          available: true,
          exactUnit: {
            select: {
              name: true
            }
          },
          sourceShoppingItem: {
            select: {
              amountJson: true
            }
          }
        }
      }),
      tx.shoppingItemFridgeReservation.findMany({
        where: {
          userId,
          releasedAt: null,
          settledAt: null
        },
        select: {
          fridgeItemId: true,
          reservedQuantity: true
        }
      })
    ]);

    const reservedMap = new Map<UUID, Prisma.Decimal>();
    for (const reservation of reservations) {
      const current = reservedMap.get(reservation.fridgeItemId) ?? new Prisma.Decimal(0);
      reservedMap.set(reservation.fridgeItemId, current.add(reservation.reservedQuantity));
    }

    return fridgeItems.map(item => {
      const resolvedExact = this.resolveFridgeExactAmount(item);
      if (!resolvedExact) {
        return {
          id: item.id,
          ingredientId: item.ingredientId,
          name: item.name,
          quantityText: item.quantityText,
          exactQuantity: null,
          exactUnitId: null,
          exactUnitName: null,
          available: item.available
        } satisfies FridgeMatchRow;
      }
      const reservedQuantity = reservedMap.get(item.id) ?? new Prisma.Decimal(0);
      const remainingQuantity = resolvedExact.quantity.sub(reservedQuantity);
      const exactQuantity = remainingQuantity.gt(0) ? remainingQuantity : new Prisma.Decimal(0);
      return {
        id: item.id,
        ingredientId: item.ingredientId,
        name: item.name,
        quantityText: this.formatExactQuantityText(exactQuantity, resolvedExact.unitName),
        exactQuantity,
        exactUnitId: resolvedExact.unitId,
        exactUnitName: resolvedExact.unitName,
        available: exactQuantity.gt(0)
      } satisfies FridgeMatchRow;
    });
  }

  private async releaseShoppingItemReservations(tx: Prisma.TransactionClient, shoppingItemIds: UUID[], releasedAt: Date) {
    const uniqueIds = Array.from(new Set(shoppingItemIds));
    if (!uniqueIds.length) return;
    await tx.shoppingItemFridgeReservation.updateMany({
      where: {
        shoppingItemId: {
          in: uniqueIds
        },
        releasedAt: null,
        settledAt: null
      },
      data: {
        releasedAt
      }
    });
  }

  private async releaseShoppingListReservationsAndRestoreItems(tx: Prisma.TransactionClient, listId: UUID, releasedAt: Date) {
    const appliedItems = await tx.shoppingItem.findMany({
      where: {
        listId,
        fridgeAppliedQuantityText: {
          not: null
        },
        status: {
          not: "DELETED"
        }
      },
      select: {
        id: true,
        quantityText: true,
        baseQuantityText: true
      }
    });
    if (!appliedItems.length) return;

    await this.releaseShoppingItemReservations(tx, appliedItems.map(item => item.id), releasedAt);
    for (const item of appliedItems) {
      await tx.shoppingItem.update({
        where: {
          id: item.id
        },
        data: {
          quantityText: item.baseQuantityText ?? item.quantityText,
          fridgeAppliedQuantityText: null,
          fridgeCovered: false,
          version: { increment: 1 }
        }
      });
    }
  }

  private async settleShoppingListReservations(tx: Prisma.TransactionClient, listId: UUID, settledAt: Date) {
    const reservations = await tx.shoppingItemFridgeReservation.findMany({
      where: {
        shoppingListId: listId,
        releasedAt: null,
        settledAt: null
      },
      select: {
        id: true,
        fridgeItemId: true,
        reservedQuantity: true,
        reservedUnitId: true
      }
    });
    if (!reservations.length) return;

    const grouped = new Map<UUID, { reservedQuantity: Prisma.Decimal; reservedUnitId: UUID; reservationIds: UUID[] }>();
    for (const reservation of reservations) {
      const current = grouped.get(reservation.fridgeItemId);
      if (current) {
        if (current.reservedUnitId !== reservation.reservedUnitId) {
          throw new BadRequestException("库存预占单位不一致，暂时不能完成清单");
        }
        current.reservedQuantity = current.reservedQuantity.add(reservation.reservedQuantity);
        current.reservationIds.push(reservation.id);
        continue;
      }
      grouped.set(reservation.fridgeItemId, {
        reservedQuantity: new Prisma.Decimal(reservation.reservedQuantity),
        reservedUnitId: reservation.reservedUnitId,
        reservationIds: [reservation.id]
      });
    }

    const fridgeItems = await tx.fridgeItem.findMany({
      where: {
        id: {
          in: [...grouped.keys()]
        }
      },
      select: {
        id: true,
        available: true,
        quantityText: true,
        exactQuantity: true,
        exactUnitId: true,
        exactUnit: {
          select: {
            name: true
          }
        },
        sourceShoppingItem: {
          select: {
            amountJson: true
          }
        }
      }
    });
    const fridgeMap = new Map(fridgeItems.map(item => [item.id, item]));
    for (const [fridgeItemId, current] of grouped) {
      const fridgeItem = fridgeMap.get(fridgeItemId);
      if (!fridgeItem) {
        throw new BadRequestException("预占库存已变更，请刷新后重试");
      }
      const resolvedExact = this.resolveFridgeExactAmount(fridgeItem);
      if (!resolvedExact) {
        throw new BadRequestException("预占库存已变更，请刷新后重试");
      }
      if (!fridgeItem.available) {
        throw new BadRequestException("预占库存已失效，请刷新后重试");
      }
      if (resolvedExact.unitId !== current.reservedUnitId) {
        throw new BadRequestException("预占库存单位已变更，请刷新后重试");
      }
      const remainingQuantity = resolvedExact.quantity.sub(current.reservedQuantity);
      if (remainingQuantity.lt(0)) {
        throw new BadRequestException("预占库存已不足，请刷新后重试");
      }
      const hasRemainingQuantity = remainingQuantity.gt(0);
      await tx.fridgeItem.update({
        where: {
          id: fridgeItemId
        },
        data: {
          quantityText: this.formatExactQuantityText(remainingQuantity, resolvedExact.unitName),
          exactQuantity: hasRemainingQuantity ? remainingQuantity : null,
          exactUnitId: hasRemainingQuantity ? resolvedExact.unitId : null,
          available: hasRemainingQuantity,
          consumedAt: hasRemainingQuantity ? null : settledAt,
          version: { increment: 1 }
        }
      });
      await tx.shoppingItemFridgeReservation.updateMany({
        where: {
          id: {
            in: current.reservationIds
          }
        },
        data: {
          settledAt
        }
      });
    }
  }

  private async loadShoppingListPageFromTx(
    tx: Prisma.TransactionClient,
    userId: UUID,
    status?: "ACTIVE" | "COMPLETED" | "VOIDED" | null
  ): Promise<ShoppingListPageResponse> {
    const lists = await tx.shoppingList.findMany({
      where: {
        ...(status ? { status } : {}),
        members: {
          some: {
            userId
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        voidedAt: true,
        owner: {
          select: {
            uid: true,
            nickname: true
          }
        },
        members: {
          where: {
            userId
          },
          select: {
            role: true
          }
        },
        _count: {
          select: {
            members: true,
            invites: {
              where: {
                status: "PENDING"
              }
            }
          }
        },
        shareTokens: {
          where: {
            disabledAt: null
          },
          select: {
            id: true
          }
        },
        items: {
          where: {
            status: {
              not: "DELETED"
            }
          },
          select: {
            ingredientId: true,
            name: true,
            status: true,
            fridgeCovered: true
          }
        }
      }
    });
    return {
      items: await Promise.all(lists.map(list => this.toShoppingListSummary(tx, list)))
    };
  }

  private async loadShoppingListDetailFromTx(tx: Prisma.TransactionClient, userId: UUID, listId: UUID): Promise<ShoppingListDetail> {
    const list = await tx.shoppingList.findFirst({
      where: {
        id: listId,
        members: {
          some: {
            userId
          }
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        voidedAt: true,
        owner: {
          select: {
            uid: true,
            nickname: true
          }
        },
        members: {
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }, { id: "asc" }],
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                uid: true,
                nickname: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            invites: {
              where: {
                status: "PENDING"
              }
            }
          }
        },
        shareTokens: {
          where: {
            disabledAt: null
          },
          select: {
            id: true
          }
        },
        items: {
          where: {
            status: {
              not: "DELETED"
            }
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: shoppingDetailItemSelect
        }
      }
    });
    if (!list || !list.members.length) {
      throw new NotFoundException("购物清单不存在");
    }
    const currentMember = list.members.find(member => member.userId === userId);
    if (!currentMember) {
      throw new NotFoundException("购物清单不存在");
    }
    const fridgeRows = currentMember.role === "OWNER" && list.status === "ACTIVE"
      ? await this.loadShoppingFridgeRows(tx, list.ownerUserId)
      : [];
    const detailItemMap = this.buildShoppingListDetailItemMap(
      list.items,
      fridgeRows,
      currentMember.role === "OWNER" && list.status === "ACTIVE"
    );
    return {
      ...(await this.toShoppingListSummary(tx, {
        ...list,
        members: [{ role: currentMember.role }]
      })),
      collaborators: list.members.map(member => this.toShoppingListCollaborator(member)),
      items: list.items.map(item => detailItemMap.get(item.id)!)
    };
  }

  private async assertPlanShoppingSource(
    tx: Prisma.TransactionClient,
    userId: UUID,
    planItemId: UUID,
    recipeId: UUID,
    sourceVersionId: UUID
  ) {
    const plan = await tx.mealPlanItem.findFirst({
      where: {
        id: planItemId,
        userId
      },
      select: {
        id: true,
        dishes: {
          where: {
            recipeId,
            recipeVersionId: sourceVersionId
          },
          select: {
            id: true
          },
          take: 1
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("计划不存在");
    }
    if (!plan.dishes.length) {
      throw new BadRequestException("计划里的菜谱已变更，请刷新后重试");
    }
  }

  private async readPlanShoppingRecipes(tx: Prisma.TransactionClient, userId: UUID, planItemId: UUID): Promise<PlanShoppingRecipe[]> {
    const plan = await tx.mealPlanItem.findFirst({
      where: {
        id: planItemId,
        userId
      },
      select: {
        id: true,
        dishes: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            recipeId: true,
            recipeVersionId: true
          }
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("计划不存在");
    }

    const seen = new Set<string>();
    const recipes: PlanShoppingRecipe[] = [];
    for (const dish of plan.dishes) {
      if (!dish.recipeId) continue;
      const key = `${dish.recipeId}:${dish.recipeVersionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recipes.push({
        recipeId: dish.recipeId,
        sourceVersionId: dish.recipeVersionId
      });
    }
    if (!recipes.length) {
      throw new BadRequestException("当前餐次没有可加入采购清单的菜谱");
    }
    return recipes;
  }

  private async toShoppingListSummary(tx: EntitlementReader, list: {
    id: UUID;
    name: string;
    status: "ACTIVE" | "COMPLETED" | "VOIDED";
    ownerUserId: UUID;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    voidedAt: Date | null;
    owner: { uid: number; nickname: string | null };
    members: Array<{ role: "OWNER" | "COLLABORATOR" }>;
    _count: { members: number; invites: number };
    shareTokens: Array<{ id: UUID }>;
    items: ShoppingListProgressRow[];
  }): Promise<ShoppingListSummary> {
    const { progressDoneCount, progressTotalCount } = this.buildShoppingListProgress(list.items);
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, list.ownerUserId);
    return {
      id: list.id,
      name: list.name,
      status: list.status,
      role: list.members[0]?.role ?? "COLLABORATOR",
      ownerUid: list.owner.uid,
      ownerNickname: list.owner.nickname,
      memberCount: list._count.members,
      memberLimit,
      pendingInviteCount: list._count.invites,
      progressDoneCount,
      progressTotalCount,
      hasActiveShareLink: list.shareTokens.length > 0,
      version: list.version,
      createdAt: toIsoDate(list.createdAt),
      updatedAt: toIsoDate(list.updatedAt),
      completedAt: list.completedAt ? toIsoDate(list.completedAt) : null,
      voidedAt: list.voidedAt ? toIsoDate(list.voidedAt) : null
    };
  }

  private buildShoppingListProgress(items: ShoppingListProgressRow[]) {
    const bucket = new Map<string, ShoppingListProgressRow[]>();
    for (const item of items) {
      if (item.status === "DELETED") continue;
      const key = this.buildShoppingItemGroupKey(item);
      const current = bucket.get(key) ?? [];
      current.push(item);
      bucket.set(key, current);
    }
    let progressDoneCount = 0;
    for (const groupItems of bucket.values()) {
      if (groupItems.every(item => item.status === "BOUGHT" || item.fridgeCovered)) {
        progressDoneCount += 1;
      }
    }
    return {
      progressDoneCount,
      progressTotalCount: bucket.size
    };
  }

  private async toShoppingListInviteSummary(tx: EntitlementReader, invite: {
    id: UUID;
    status: ShoppingListInviteStatus;
    createdAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    list: {
      id: UUID;
      name: string;
      status: "ACTIVE" | "COMPLETED" | "VOIDED";
      ownerUserId: UUID;
      owner: { uid: number; nickname: string | null };
      _count: {
        members: number;
        items: number;
      };
      members: Array<{ role: "OWNER" | "COLLABORATOR" }>;
    };
  }): Promise<ShoppingListInviteSummary> {
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, invite.list.ownerUserId);
    return {
      id: invite.id,
      listId: invite.list.id,
      name: invite.list.name,
      ownerUid: invite.list.owner.uid,
      ownerNickname: invite.list.owner.nickname,
      memberCount: invite.list._count.members,
      memberLimit,
      itemCount: invite.list._count.items,
      status: invite.list.status,
      inviteStatus: invite.status,
      canJoin: invite.list.status === "ACTIVE" && invite.list.members.length === 0 && invite.list._count.members < memberLimit,
      invitedAt: toIsoDate(invite.createdAt),
      handledAt: invite.acceptedAt ? toIsoDate(invite.acceptedAt) : invite.declinedAt ? toIsoDate(invite.declinedAt) : null
    };
  }

  private buildShoppingListInviteWhere(
    userId: UUID,
    filter: ShoppingListInviteFilter,
    cutoffAt: Date,
    preservePendingHome: boolean
  ): Prisma.ShoppingListInviteWhereInput {
    if (filter === "PENDING") {
      const pendingWhere: Prisma.ShoppingListInviteWhereInput = {
        targetUserId: userId,
        status: "PENDING",
        list: {
          status: "ACTIVE"
        }
      };
      if (!preservePendingHome) {
        pendingWhere.createdAt = {
          gte: cutoffAt
        };
      }
      return {
        ...pendingWhere
      };
    }

    if (filter === "RESOLVED") {
      return {
        targetUserId: userId,
        OR: [
          {
            status: "ACCEPTED",
            acceptedAt: {
              gte: cutoffAt
            }
          },
          {
            status: "DECLINED",
            declinedAt: {
              gte: cutoffAt
            }
          }
        ]
      };
    }

    return {
      targetUserId: userId,
      OR: [
        {
          status: "PENDING",
          createdAt: {
            gte: cutoffAt
          },
          list: {
            status: "ACTIVE"
          }
        },
        {
          status: "ACCEPTED",
          acceptedAt: {
            gte: cutoffAt
          }
        },
        {
          status: "DECLINED",
          declinedAt: {
            gte: cutoffAt
          }
        }
      ]
    };
  }

  private toShoppingItemSourceSummary(item: {
    sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
    note: string | null;
    sourceKey: string | null;
    sourceRecipeId: UUID | null;
    sourceRecipeVersionId: UUID | null;
    sourceRecipeTitle: string | null;
    sourceBaseServings: number | null;
    sourceBatchKey: string | null;
  }): ShoppingItemSourceSummary {
    return {
      sourceType: item.sourceType,
      title: item.sourceRecipeTitle ?? item.note ?? null,
      recipeId: item.sourceRecipeId,
      sourceVersionId: item.sourceRecipeVersionId,
      planItemId: item.sourceType === "PLAN" && item.sourceKey ? Number(item.sourceKey) || null : null,
      diningEventId: item.sourceType === "EVENT" && item.sourceKey ? Number(item.sourceKey.split(":")[0]) || null : null,
      sourceBatchKey: item.sourceBatchKey,
      addCount: item.sourceType === "RECIPE" && item.sourceBatchKey ? 1 : null,
      servings: item.sourceBaseServings
    };
  }

  private readShoppingItemExactAmount(amountJson: Prisma.JsonValue | null) {
    if (!amountJson) return null;
    const amount = fromJson<RecipeAmountSnapshot>(amountJson);
    return amount.kind === "EXACT" ? amount : null;
  }

  private parseExactQuantityByUnit(quantityText: string | null, unitName: string) {
    if (!quantityText) return null;
    const pattern = new RegExp(`^([+-]?\\d+(?:\\.\\d+)?)\\s*${escapeRegExp(unitName)}$`);
    const match = quantityText.trim().match(pattern);
    if (!match?.[1]) return null;
    return new Prisma.Decimal(match[1]);
  }

  private resolveFridgeExactAmount(item: {
    quantityText: string | null;
    exactQuantity: Prisma.Decimal | null;
    exactUnitId: UUID | null;
    exactUnit?: { name: string } | null;
    sourceShoppingItem?: { amountJson: Prisma.JsonValue | null } | null;
  }) {
    if (item.exactQuantity !== null && item.exactUnitId !== null && item.exactUnit?.name) {
      return {
        quantity: new Prisma.Decimal(item.exactQuantity),
        unitId: item.exactUnitId,
        unitName: item.exactUnit.name
      };
    }
    const sourceAmount = item.sourceShoppingItem?.amountJson
      ? this.readShoppingItemExactAmount(item.sourceShoppingItem.amountJson)
      : null;
    if (!sourceAmount) return null;
    const parsedQuantity = this.parseExactQuantityByUnit(item.quantityText, sourceAmount.unitName);
    if (!parsedQuantity) return null;
    return {
      quantity: parsedQuantity,
      unitId: sourceAmount.unitId,
      unitName: sourceAmount.unitName
    };
  }

  private matchFridgeRows(
    item: { ingredientId: UUID | null; name: string },
    fridgeRows: FridgeMatchRow[]
  ) {
    if (item.ingredientId !== null) {
      const matchedByIngredient = fridgeRows.filter(row => row.ingredientId === item.ingredientId);
      if (matchedByIngredient.length) {
        return matchedByIngredient;
      }
    }
    const nameKey = normalizeNameKey(item.name);
    return fridgeRows.filter(row => normalizeNameKey(row.name) === nameKey);
  }

  private matchExactFridgeRows(
    fridgeRows: FridgeMatchRow[],
    exactAmount: Extract<RecipeAmountSnapshot, { kind: "EXACT" }>
  ) {
    const targetUnitKey = normalizeNameKey(exactAmount.unitName);
    const comparable = fridgeRows.filter(
      row =>
        row.exactQuantity !== null &&
        row.exactUnitId !== null &&
        row.exactUnitName &&
        (row.exactUnitId === exactAmount.unitId || normalizeNameKey(row.exactUnitName) === targetUnitKey)
    );
    const exactIdMatches = comparable.filter(row => row.exactUnitId === exactAmount.unitId);
    return exactIdMatches.length ? exactIdMatches : comparable;
  }

  private sumMatchingFridgeQuantity(
    fridgeRows: FridgeMatchRow[],
    exactAmount: Extract<RecipeAmountSnapshot, { kind: "EXACT" }>
  ) {
    const comparable = this.matchExactFridgeRows(fridgeRows, exactAmount);
    if (!comparable.length) return null;
    return {
      quantity: comparable.reduce((current, row) => current.add(row.exactQuantity ?? 0), new Prisma.Decimal(0)),
      unitName: comparable[0]!.exactUnitName!
    };
  }

  private buildFridgeText(fridgeRows: FridgeMatchRow[], exactText: string | null) {
    if (exactText) return `冰箱：${exactText}`;
    if (!fridgeRows.length) return null;
    if (fridgeRows.length === 1) {
      const [current] = fridgeRows;
      if (current?.quantityText) return `冰箱：${current.quantityText}`;
      return "冰箱：有库存记录";
    }
    return `冰箱：有 ${fridgeRows.length} 条记录`;
  }

  private buildShoppingItemGroupKey(item: { ingredientId: UUID | null; name: string }) {
    return `${item.ingredientId ?? "none"}:${normalizeNameKey(item.name)}`;
  }

  private cloneFridgeRows(fridgeRows: FridgeMatchRow[]) {
    return fridgeRows.map(row => ({
      ...row,
      exactQuantity: row.exactQuantity ? new Prisma.Decimal(row.exactQuantity) : null
    }));
  }

  private reserveFridgeRows(
    fridgeRows: FridgeMatchRow[],
    reservations: Array<{ fridgeItemId: UUID; reservedQuantity: Prisma.Decimal }>
  ) {
    if (!reservations.length) return;
    const reservedMap = new Map<UUID, Prisma.Decimal>();
    for (const reservation of reservations) {
      const current = reservedMap.get(reservation.fridgeItemId) ?? new Prisma.Decimal(0);
      reservedMap.set(reservation.fridgeItemId, current.add(reservation.reservedQuantity));
    }
    for (let index = 0; index < fridgeRows.length; index += 1) {
      const currentRow = fridgeRows[index]!;
      const reservedQuantity = reservedMap.get(currentRow.id);
      if (!reservedQuantity || currentRow.exactQuantity === null) continue;
      const nextQuantity = currentRow.exactQuantity.sub(reservedQuantity);
      const exactQuantity = nextQuantity.gt(0) ? nextQuantity : new Prisma.Decimal(0);
      fridgeRows[index] = {
        ...currentRow,
        quantityText: currentRow.exactUnitName ? this.formatExactQuantityText(exactQuantity, currentRow.exactUnitName) : currentRow.quantityText,
        exactQuantity,
        available: exactQuantity.gt(0)
      };
    }
  }

  private buildShoppingItemFridgeMeta(
    item: Pick<
      ShoppingDetailItemRow,
      "ingredientId" | "name" | "quantityText" | "baseQuantityText" | "fridgeAppliedQuantityText" | "fridgeCovered" | "status" | "amountJson"
    >,
    fridgeRows: FridgeMatchRow[],
    canUseFridgeAction: boolean,
    showFridgeText = true,
    displayAppliedQuantity: Prisma.Decimal | null = null
  ): ShoppingItemFridgeMeta {
    const quantities = this.resolveShoppingItemQuantities(item);
    const matchedRows = this.matchFridgeRows(item, fridgeRows);
    const exactAmount = this.readShoppingItemExactAmount(item.amountJson);
    let exactSummary = exactAmount ? this.sumMatchingFridgeQuantity(matchedRows, exactAmount) : null;
    if (exactAmount && displayAppliedQuantity?.gt(0)) {
      const appliedQuantity = new Prisma.Decimal(displayAppliedQuantity);
      if (appliedQuantity.gt(0)) {
        exactSummary = exactSummary
          ? {
              quantity: exactSummary.quantity.add(appliedQuantity),
              unitName: exactSummary.unitName
            }
          : {
              quantity: appliedQuantity,
              unitName: exactAmount.unitName
            };
      }
    }
    const exactText = exactSummary ? this.formatExactQuantityText(exactSummary.quantity, exactSummary.unitName) : null;
    const fridgeText = showFridgeText ? this.buildFridgeText(matchedRows, exactText) : null;
    const canOperate = canUseFridgeAction && item.status === "OPEN";
    const inventoryApplied = Boolean(item.fridgeAppliedQuantityText);

    if (inventoryApplied) {
      return {
        ...quantities,
        fridgeText,
        inventoryStatus: item.fridgeCovered ? "ENOUGH" : "SHORTAGE",
        inventoryApplied: true,
        inventoryCovered: item.fridgeCovered,
        fridgeStatusText: item.fridgeCovered
          ? "库存足够，不买了"
          : quantities.remainingQuantityText
            ? `库存不足，还需买 ${quantities.remainingQuantityText}`
            : "已用库存",
        fridgeActionLabel: canOperate ? "撤销" : null,
        fridgeActionMode: canOperate ? "UNDO" : "NONE"
      } as const;
    }

    if (!matchedRows.length) {
      return {
        ...quantities,
        fridgeText: null,
        inventoryStatus: "NONE",
        inventoryApplied: false,
        inventoryCovered: false,
        fridgeStatusText: null,
        fridgeActionLabel: null,
        fridgeActionMode: "NONE"
      } as const;
    }

    if (exactAmount && exactSummary && exactSummary.quantity.gt(0)) {
      const demand = new Prisma.Decimal(exactAmount.quantity);
      if (exactSummary.quantity.gte(demand)) {
        return {
          ...quantities,
          fridgeText,
          inventoryStatus: "ENOUGH",
          inventoryApplied: false,
          inventoryCovered: false,
          fridgeStatusText: null,
          fridgeActionLabel: canOperate ? "用库存" : null,
          fridgeActionMode: canOperate ? "APPLY_FULL" : "NONE"
        } as const;
      }
      const remaining = demand.sub(exactSummary.quantity);
      const remainingText = this.formatExactQuantityText(remaining, exactAmount.unitName);
      return {
        ...quantities,
        fridgeText,
        inventoryStatus: "SHORTAGE",
        inventoryApplied: false,
        inventoryCovered: false,
        fridgeStatusText: `库存不足，还需买 ${remainingText}`,
        fridgeActionLabel: canOperate ? "用库存" : null,
        fridgeActionMode: canOperate ? "APPLY_PARTIAL" : "NONE"
      } as const;
    }

    if (exactAmount && exactSummary) {
      return {
        ...quantities,
        fridgeText,
        inventoryStatus: "SHORTAGE",
        inventoryApplied: false,
        inventoryCovered: false,
        fridgeStatusText: null,
        fridgeActionLabel: null,
        fridgeActionMode: "NONE"
      } as const;
    }

    return {
      ...quantities,
      fridgeText,
      inventoryStatus: "UNKNOWN",
      inventoryApplied: false,
      inventoryCovered: false,
      fridgeStatusText: "库存待确认",
      fridgeActionLabel: canOperate ? "库存待确认" : null,
      fridgeActionMode: canOperate ? "NEED_CONFIRM" : "NONE"
    } as const;
  }

  private resolveShoppingItemQuantities(item: Pick<ShoppingDetailItemRow, "quantityText" | "baseQuantityText" | "fridgeAppliedQuantityText" | "amountJson">) {
    const exactAmount = this.readShoppingItemExactAmount(item.amountJson);
    const requiredQuantityText = item.baseQuantityText?.trim()
      || (exactAmount ? this.formatExactQuantityText(exactAmount.quantity, exactAmount.unitName) : item.quantityText);
    const appliedInventoryQuantityText = item.fridgeAppliedQuantityText?.trim() || null;
    if (!exactAmount || !appliedInventoryQuantityText) {
      return {
        requiredQuantityText: requiredQuantityText ?? null,
        remainingQuantityText: appliedInventoryQuantityText ? requiredQuantityText ?? null : requiredQuantityText ?? null,
        appliedInventoryQuantityText
      };
    }
    const appliedQuantity = this.parseExactQuantityByUnit(appliedInventoryQuantityText, exactAmount.unitName);
    if (appliedQuantity === null) {
      return {
        requiredQuantityText: requiredQuantityText ?? null,
        remainingQuantityText: requiredQuantityText ?? null,
        appliedInventoryQuantityText
      };
    }
    const remainingQuantity = new Prisma.Decimal(exactAmount.quantity).sub(appliedQuantity);
    return {
      requiredQuantityText: requiredQuantityText ?? null,
      remainingQuantityText: remainingQuantity.gt(0) ? this.formatExactQuantityText(remainingQuantity, exactAmount.unitName) : null,
      appliedInventoryQuantityText
    };
  }

  private sumGroupAppliedDisplayQuantity(
    groupItems: ShoppingDetailItemRow[],
    amountJson: Prisma.JsonValue | null
  ) {
    const exactAmount = this.readShoppingItemExactAmount(amountJson);
    if (!exactAmount) return null;
    let total = new Prisma.Decimal(0);
    let hasValue = false;
    for (const item of groupItems) {
      if (!item.fridgeAppliedQuantityText) continue;
      const parsedQuantity = this.parseExactQuantityByUnit(item.fridgeAppliedQuantityText, exactAmount.unitName);
      if (parsedQuantity === null) continue;
      total = total.add(parsedQuantity);
      hasValue = true;
    }
    return hasValue ? total : null;
  }

  private buildShoppingListDetailItemMap(
    items: ShoppingDetailItemRow[],
    fridgeRows: FridgeMatchRow[],
    canUseFridgeAction: boolean
  ) {
    const result = new Map<UUID, ShoppingListDetailItem>();
    const remainingFridgeRows = this.cloneFridgeRows(fridgeRows);
    const groupedItems = new Map<string, ShoppingDetailItemRow[]>();
    for (const item of items) {
      const groupKey = this.buildShoppingItemGroupKey(item);
      const current = groupedItems.get(groupKey) ?? [];
      current.push(item);
      groupedItems.set(groupKey, current);
    }
    const shownGroupKeys = new Set<string>();
    for (const item of items) {
      const groupKey = this.buildShoppingItemGroupKey(item);
      const showFridgeText = !shownGroupKeys.has(groupKey);
      const groupItems = groupedItems.get(groupKey) ?? [item];
      const displayAppliedQuantity = showFridgeText ? this.sumGroupAppliedDisplayQuantity(groupItems, item.amountJson) : null;
      const fridgeMeta = this.buildShoppingItemFridgeMeta(
        item,
        remainingFridgeRows,
        canUseFridgeAction,
        showFridgeText,
        displayAppliedQuantity
      );
      shownGroupKeys.add(groupKey);
      result.set(item.id, this.toShoppingListDetailItem(item, fridgeMeta));
      if (!canUseFridgeAction || item.status !== "OPEN" || item.fridgeAppliedQuantityText) continue;
      const reservationPlan = this.buildShoppingItemReservationPlan(item, remainingFridgeRows);
      if (reservationPlan.mode !== "APPLY_FULL" && reservationPlan.mode !== "APPLY_PARTIAL") continue;
      this.reserveFridgeRows(remainingFridgeRows, reservationPlan.reservations);
    }
    return result;
  }

  private toShoppingListDetailItem(item: ShoppingDetailItemRow, fridgeMeta: ShoppingItemFridgeMeta): ShoppingListDetailItem {
    return {
      id: item.id,
      ingredientId: item.ingredientId,
      name: item.name,
      categoryName: item.ingredient?.category.name ?? null,
      imageUrl: item.ingredient ? this.ingredientImageService.buildImageUrl({}, item.ingredient.id, item.ingredient.imageUpdatedAt) : null,
      quantityText: fridgeMeta.requiredQuantityText,
      requiredQuantityText: fridgeMeta.requiredQuantityText,
      remainingQuantityText: fridgeMeta.remainingQuantityText,
      appliedInventoryQuantityText: fridgeMeta.appliedInventoryQuantityText,
      note: item.note,
      status: toListItemStatus(item.status),
      fridgeText: fridgeMeta.fridgeText,
      inventoryStatus: fridgeMeta.inventoryStatus,
      inventoryApplied: fridgeMeta.inventoryApplied,
      inventoryCovered: fridgeMeta.inventoryCovered,
      fridgeStatusText: fridgeMeta.fridgeStatusText,
      fridgeActionLabel: fridgeMeta.fridgeActionLabel,
      fridgeActionMode: fridgeMeta.fridgeActionMode,
      checkedAt: item.checkedAt ? toIsoDate(item.checkedAt) : null,
      updatedAt: toIsoDate(item.updatedAt),
      sources: [this.toShoppingItemSourceSummary(item)]
    };
  }

  private buildShoppingItemReservationPlan(
    item: {
      ingredientId: UUID | null;
      name: string;
      quantityText: string | null;
      amountJson: Prisma.JsonValue | null;
    },
    fridgeRows: FridgeMatchRow[]
  ) {
    const exactAmount = this.readShoppingItemExactAmount(item.amountJson);
    if (!exactAmount) {
      return {
        mode: "NEED_CONFIRM" as const,
        reservations: [],
        appliedQuantityText: null,
        nextQuantityText: item.quantityText,
        covered: false
      };
    }

    const matchedRows = this.matchFridgeRows(item, fridgeRows);
    const exactRows = this.matchExactFridgeRows(matchedRows, exactAmount)
      .sort((left, right) => left.id - right.id);
    if (!exactRows.length) {
      return {
        mode: matchedRows.length ? "NEED_CONFIRM" as const : "NONE" as const,
        reservations: [],
        appliedQuantityText: null,
        nextQuantityText: item.quantityText,
        covered: false
      };
    }

    const totalAvailable = exactRows.reduce((current, row) => current.add(row.exactQuantity ?? 0), new Prisma.Decimal(0));
    if (totalAvailable.lte(0)) {
      return {
        mode: "NONE" as const,
        reservations: [],
        appliedQuantityText: null,
        nextQuantityText: item.quantityText,
        covered: false
      };
    }

    const demand = new Prisma.Decimal(exactAmount.quantity);
    const reserveQuantity = totalAvailable.gte(demand) ? demand : totalAvailable;
    let remainingReserve = new Prisma.Decimal(reserveQuantity);
    const reservations: Array<{ fridgeItemId: UUID; reservedQuantity: Prisma.Decimal; reservedUnitId: UUID }> = [];
    for (const row of exactRows) {
      if (remainingReserve.lte(0)) break;
      const currentQuantity = row.exactQuantity ?? new Prisma.Decimal(0);
      if (currentQuantity.lte(0)) continue;
      const reservedQuantity = currentQuantity.gte(remainingReserve) ? remainingReserve : currentQuantity;
      reservations.push({
        fridgeItemId: row.id,
        reservedQuantity,
        reservedUnitId: row.exactUnitId!
      });
      remainingReserve = remainingReserve.sub(reservedQuantity);
    }

    const covered = totalAvailable.gte(demand);
    return {
      mode: covered ? "APPLY_FULL" as const : "APPLY_PARTIAL" as const,
      reservations,
      appliedQuantityText: this.formatExactQuantityText(reserveQuantity, exactAmount.unitName),
      nextQuantityText: covered ? null : this.formatExactQuantityText(demand.sub(reserveQuantity), exactAmount.unitName),
      covered
    };
  }

  private toShoppingListCollaborator(member: {
    userId: UUID;
    role: "OWNER" | "COLLABORATOR";
    joinedAt: Date;
    user: {
      uid: number;
      nickname: string | null;
      avatarUrl: string | null;
    };
  }): ShoppingListCollaborator {
    return {
      userId: member.userId,
      role: member.role,
      joinedAt: toIsoDate(member.joinedAt),
      user: {
        uid: member.user.uid,
        nickname: member.user.nickname,
        avatarUrl: member.user.avatarUrl
      }
    };
  }

  private async assertShareableDiningGroupUsers(tx: Prisma.TransactionClient, userId: UUID, targetUserIds: UUID[]) {
    if (!targetUserIds.length) return;
    const groups = await tx.diningGroup.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                status: "ACTIVE"
              }
            }
          }
        ]
      },
      select: {
        ownerId: true,
        members: {
          where: {
            status: "ACTIVE"
          },
          select: {
            userId: true
          }
        }
      }
    });
    const allowedUserIds = new Set<UUID>();
    for (const group of groups) {
      allowedUserIds.add(group.ownerId);
      for (const member of group.members) {
        allowedUserIds.add(member.userId);
      }
    }
    for (const targetUserId of targetUserIds) {
      if (!allowedUserIds.has(targetUserId)) {
        throw new ForbiddenException("只能分享给当前饭搭子成员");
      }
    }
  }

  private async resolveShoppingListMemberLimit(tx: EntitlementReader, ownerUserId: UUID) {
    const tier = await this.entitlementService.getTier(tx, ownerUserId);
    return policy.shoppingListMemberLimit[tier];
  }

  private async resolveShoppingListInviteMessageDays(tx: EntitlementReader, userId: UUID) {
    const tier = await this.entitlementService.getTier(tx, userId);
    return policy.shoppingListInviteMessageDays[tier];
  }

  private async assertShoppingListMemberCapacity(
    tx: Prisma.TransactionClient,
    listId: UUID,
    ownerUserId: UUID,
    targetUserIds: UUID[]
  ) {
    if (!targetUserIds.length) return;
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, ownerUserId);
    const members = await tx.shoppingListMember.findMany({
      where: { listId },
      select: {
        userId: true
      }
    });
    const memberIds = new Set(members.map(item => item.userId));
    const nextNewCount = targetUserIds.filter(userId => !memberIds.has(userId)).length;
    if (memberIds.size + nextNewCount > memberLimit) {
      throw new ConflictException("协作者已满");
    }
  }

  private async assertShoppingListInviteCapacity(
    tx: EntitlementReader,
    ownerUserId: UUID,
    memberCount: number,
    nextInviteCount: number
  ) {
    if (!nextInviteCount) return;
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, ownerUserId);
    if (memberCount >= memberLimit) {
      throw new ConflictException("协作者已满");
    }
  }

  private async closeShoppingShareInTx(tx: Prisma.TransactionClient, listId: UUID) {
    const now = new Date();
    await tx.shoppingShareToken.updateMany({
      where: {
        listId,
        disabledAt: null
      },
      data: {
        disabledAt: now
      }
    });
    await tx.shoppingListInvite.updateMany({
      where: {
        listId,
        status: "PENDING"
      },
      data: {
        status: "REVOKED",
        revokedAt: now
      }
    });
  }

  private async loadShoppingBoardFromTx(tx: Prisma.TransactionClient, userId: UUID) {
    const items = await tx.shoppingItem.findMany({
      where: {
        userId,
        status: "OPEN"
      },
      select: shoppingRowSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });
    return this.buildShoppingBoard(items.map(this.toShoppingRow));
  }

  private async loadRecipeShoppingSource(
    tx: Prisma.TransactionClient,
    userId: UUID,
    recipeId: UUID,
    sourceVersionId: UUID,
    allowHistoricalVersion = false
  ): Promise<RecipeShoppingSource> {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        currentVersionId: true,
        inspirationCategoryId: true
      }
    });
    if (!recipe) {
      throw new NotFoundException("菜谱不存在");
    }

    if (allowHistoricalVersion) {
      const version = await tx.recipeContentVersion.findUnique({
        where: { id: sourceVersionId },
        select: {
          id: true,
          name: true,
          story: true,
          baseServings: true,
          difficulty: true,
          duration: true,
          estimatedCalories: true,
          tips: true,
          ingredientsJson: true,
          stepsJson: true
        }
      });
      if (!version) {
        throw new NotFoundException("菜谱版本不存在");
      }
      const content = versionToContent(version);
      return {
        recipeId,
        sourceVersionId,
        title: content.name,
        baseServings: content.baseServings,
        ingredients: content.ingredients
      };
    }

    if (recipe.status !== "ACTIVE") {
      throw new NotFoundException("菜谱不存在");
    }

    const isOwnedCurrent = recipe.ownerId === userId && recipe.currentVersionId === sourceVersionId;
    const isPublicCurrent = recipe.ownerId === null && recipe.inspirationCategoryId !== null && recipe.currentVersionId === sourceVersionId;
    const hasCollection = isOwnedCurrent || isPublicCurrent
      ? true
      : Boolean(
          await tx.recipeCollection.findFirst({
            where: {
              userId,
              sourceRecipeId: recipeId,
              sourceVersionId
            },
            select: { id: true }
          })
        );

    if (!isOwnedCurrent && !isPublicCurrent && !hasCollection) {
      throw new NotFoundException("菜谱不存在");
    }

    const version = await tx.recipeContentVersion.findUnique({
      where: { id: sourceVersionId },
      select: {
        id: true,
        name: true,
        story: true,
        baseServings: true,
        difficulty: true,
        duration: true,
        estimatedCalories: true,
        tips: true,
        ingredientsJson: true,
        stepsJson: true
      }
    });
    if (!version) {
      throw new NotFoundException("菜谱版本不存在");
    }

    const content = versionToContent(version);
    return {
      recipeId,
      sourceVersionId,
      title: content.name,
      baseServings: content.baseServings,
      ingredients: content.ingredients
    };
  }

  private buildShoppingBoard(items: ShoppingRow[]): ShoppingBoardResponse {
    const recipeItems = items.filter(item => this.isRecipeShoppingRow(item));
    return {
      ingredientGroups: this.buildIngredientGroups(recipeItems),
      recipeGroups: this.buildRecipeGroups(recipeItems),
      otherItems: items.filter(item => item.sourceType !== "RECIPE").map(this.toShoppingItemSummary)
    };
  }

  private buildIngredientGroups(items: RecipeShoppingRow[]): ShoppingIngredientGroup[] {
    const groupMap = new Map<
      UUID,
      {
        name: string;
        amountMap: Map<string, ExactAmountGroup>;
        fuzzyMap: Map<string, number>;
        recipeTitles: Set<string>;
        updatedAt: Date;
      }
    >();

    for (const item of items) {
      const amount = this.readRecipeAmount(item);
      const current = groupMap.get(item.ingredientId) ?? {
        name: item.name,
        amountMap: new Map<string, ExactAmountGroup>(),
        fuzzyMap: new Map<string, number>(),
        recipeTitles: new Set<string>(),
        updatedAt: item.updatedAt
      };
      current.recipeTitles.add(item.sourceRecipeTitle);
      if (item.updatedAt > current.updatedAt) {
        current.updatedAt = item.updatedAt;
      }
      this.pushAmount(current.amountMap, current.fuzzyMap, amount);
      groupMap.set(item.ingredientId, current);
    }

    return Array.from(groupMap.entries())
      .map(([ingredientId, item]) => ({
        key: this.getIngredientGroupKey(ingredientId),
        ingredientId,
        name: item.name,
        quantityLines: this.toQuantityLines(item.amountMap, item.fuzzyMap),
        recipeCount: item.recipeTitles.size,
        recipeTitles: Array.from(item.recipeTitles),
        updatedAt: toIsoDate(item.updatedAt)
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name, "zh-Hans-CN"));
  }

  private buildRecipeGroups(items: RecipeShoppingRow[]): ShoppingRecipeGroup[] {
    const groupMap = new Map<
      string,
      {
        recipeId: UUID;
        sourceVersionId: UUID;
        title: string;
        baseServings: number;
        batchKeys: Set<string>;
        updatedAt: Date;
        itemMap: Map<
          UUID,
          {
            name: string;
            sortOrder: number;
            amountMap: Map<string, ExactAmountGroup>;
            fuzzyMap: Map<string, number>;
            updatedAt: Date;
          }
        >;
      }
    >();

    for (const item of items) {
      const groupKey = this.getRecipeGroupKey(item.sourceRecipeId, item.sourceRecipeVersionId);
      const current = groupMap.get(groupKey) ?? {
        recipeId: item.sourceRecipeId,
        sourceVersionId: item.sourceRecipeVersionId,
        title: item.sourceRecipeTitle,
        baseServings: item.sourceBaseServings,
        batchKeys: new Set<string>(),
        updatedAt: item.updatedAt,
        itemMap: new Map()
      };
      current.batchKeys.add(item.sourceBatchKey);
      if (item.updatedAt > current.updatedAt) {
        current.updatedAt = item.updatedAt;
      }

      const amount = this.readRecipeAmount(item);
      const currentItem = current.itemMap.get(item.ingredientId) ?? {
        name: item.name,
        sortOrder: item.sourceIngredientSort,
        amountMap: new Map<string, ExactAmountGroup>(),
        fuzzyMap: new Map<string, number>(),
        updatedAt: item.updatedAt
      };
      if (item.updatedAt > currentItem.updatedAt) {
        currentItem.updatedAt = item.updatedAt;
      }
      if (item.sourceIngredientSort < currentItem.sortOrder) {
        currentItem.sortOrder = item.sourceIngredientSort;
      }
      this.pushAmount(currentItem.amountMap, currentItem.fuzzyMap, amount);
      current.itemMap.set(item.ingredientId, currentItem);
      groupMap.set(groupKey, current);
    }

    return Array.from(groupMap.values())
      .map(item => {
        const addCount = item.batchKeys.size;
        const groupItems: ShoppingRecipeIngredientGroup[] = Array.from(item.itemMap.entries())
          .map(([ingredientId, groupItem]) => ({
            key: this.getRecipeIngredientGroupKey(item.recipeId, item.sourceVersionId, ingredientId),
            ingredientId,
            name: groupItem.name,
            quantityLines: this.toQuantityLines(groupItem.amountMap, groupItem.fuzzyMap),
            updatedAt: toIsoDate(groupItem.updatedAt)
          }))
          .sort((left, right) => {
            const leftSort = item.itemMap.get(left.ingredientId)?.sortOrder ?? 0;
            const rightSort = item.itemMap.get(right.ingredientId)?.sortOrder ?? 0;
            return leftSort - rightSort || left.name.localeCompare(right.name, "zh-Hans-CN");
          });

        return {
          key: this.getRecipeGroupKey(item.recipeId, item.sourceVersionId),
          recipeId: item.recipeId,
          sourceVersionId: item.sourceVersionId,
          title: item.title,
          addCount,
          totalServings: item.baseServings * addCount,
          updatedAt: toIsoDate(item.updatedAt),
          items: groupItems
        };
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title, "zh-Hans-CN"));
  }

  private resolveShoppingGroupWhere(userId: UUID, targetKey: string): Prisma.ShoppingItemWhereInput {
    const ingredientMatch = /^ingredient:(\d+)$/.exec(targetKey);
    if (ingredientMatch) {
      return {
        userId,
        sourceType: recipeSourceType,
        ingredientId: Number(ingredientMatch[1])
      };
    }

    const recipeMatch = /^recipe:(\d+):(\d+):ingredient:(\d+)$/.exec(targetKey);
    if (recipeMatch) {
      return {
        userId,
        sourceType: recipeSourceType,
        sourceRecipeId: Number(recipeMatch[1]),
        sourceRecipeVersionId: Number(recipeMatch[2]),
        ingredientId: Number(recipeMatch[3])
      };
    }

    throw new BadRequestException("购物分组标识错误");
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

  private formatExactQuantityText(quantity: Prisma.Decimal | string, unitName: string) {
    return `${new Prisma.Decimal(quantity).toString()} ${unitName}`;
  }

  private normalizeExpireAt(expireAt?: string | null) {
    if (!expireAt) return null;
    const resolved = new Date(expireAt);
    if (Number.isNaN(resolved.getTime())) {
      throw new BadRequestException("到期时间参数错误");
    }
    return resolved;
  }

  private async buildFridgeWriteInput(
    tx: Prisma.TransactionClient,
    userId: UUID,
    ingredientId: UUID | null,
    name: string,
    quantityText: string | null,
    exactQuantity?: string | null,
    exactUnitId?: UUID | null,
    expireAt?: Date | null,
    note?: string | null
  ) {
    const hasExactQuantity = Boolean(exactQuantity);
    const hasExactUnit = exactUnitId !== null && exactUnitId !== undefined;
    if (hasExactQuantity !== hasExactUnit) {
      throw new BadRequestException("精确数量和单位需要一起填写");
    }
    if (hasExactQuantity && !ingredientId) {
      throw new BadRequestException("使用精确数量时需要绑定食材");
    }

    let resolvedQuantityText = quantityText;
    if (hasExactQuantity && hasExactUnit) {
      const unit = await tx.unit.findFirst({
        where: {
          id: exactUnitId,
          ownerId: null
        },
        select: {
          id: true,
          name: true
        }
      });
      if (!unit) {
        throw new NotFoundException("单位不存在");
      }
      resolvedQuantityText = this.formatExactQuantityText(exactQuantity!, unit.name);
    }

    return {
      ingredientId,
      name,
      quantityText: resolvedQuantityText,
      exactQuantity: hasExactQuantity ? new Prisma.Decimal(exactQuantity!) : null,
      exactUnitId: hasExactUnit ? exactUnitId! : null,
      expireAt: expireAt ?? null,
      note: note ?? null
    };
  }

  private async loadFridgeReservationMap(tx: Prisma.TransactionClient, fridgeItemIds: UUID[]) {
    const uniqueIds = Array.from(new Set(fridgeItemIds));
    if (!uniqueIds.length) {
      return new Map<UUID, FridgeReservationSummaryRow[]>();
    }
    const reservations = await tx.shoppingItemFridgeReservation.findMany({
      where: {
        fridgeItemId: {
          in: uniqueIds
        },
        releasedAt: null,
        settledAt: null
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        fridgeItemId: true,
        reservedQuantity: true,
        shoppingList: {
          select: {
            id: true,
            name: true
          }
        },
        shoppingItem: {
          select: {
            id: true
          }
        },
        reservedUnit: {
          select: {
            name: true
          }
        }
      }
    });

    const reservationMap = new Map<UUID, FridgeReservationSummaryRow[]>();
    for (const reservation of reservations) {
      const current = reservationMap.get(reservation.fridgeItemId) ?? [];
      current.push({
        shoppingListId: reservation.shoppingList.id,
        shoppingListName: reservation.shoppingList.name,
        shoppingItemId: reservation.shoppingItem.id,
        reservedQuantity: reservation.reservedQuantity,
        reservedUnitName: reservation.reservedUnit.name
      });
      reservationMap.set(reservation.fridgeItemId, current);
    }
    return reservationMap;
  }

  private async loadFridgeItemSummaryFromTx(tx: Prisma.TransactionClient, userId: UUID, itemId: UUID) {
    const item = await tx.fridgeItem.findFirst({
      where: {
        id: itemId,
        userId
      },
      include: {
        ingredient: {
          select: {
            category: {
              select: {
                name: true
              }
            }
          }
        },
        exactUnit: {
          select: {
            id: true,
            name: true
          }
        },
        sourceShoppingItem: {
          select: {
            amountJson: true
          }
        }
      }
    });
    if (!item) {
      throw new NotFoundException("食材不存在");
    }
    const reservationMap = await this.loadFridgeReservationMap(tx, [item.id]);
    return this.toFridgeItemSummary(item, reservationMap.get(item.id) ?? []);
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
    id: UUID;
    ingredientId: UUID | null;
    ingredient?: {
      category: {
        name: string;
      } | null;
    } | null;
    name: string;
    quantityText: string | null;
    exactQuantity: Prisma.Decimal | null;
    exactUnitId: UUID | null;
    expireAt: Date | null;
    note: string | null;
    available: boolean;
    updatedAt: Date;
    exactUnit?: {
      id: UUID;
      name: string;
    } | null;
    sourceShoppingItem?: {
      amountJson: Prisma.JsonValue | null;
    } | null;
  }, reservations: FridgeReservationSummaryRow[]): FridgeItemSummary {
    const resolvedExact = this.resolveFridgeExactAmount(item);
    const stockText = resolvedExact
      ? this.formatExactQuantityText(resolvedExact.quantity, resolvedExact.unitName)
      : item.quantityText;
    const reservedTotal = reservations.reduce((current, reservation) => current.add(reservation.reservedQuantity), new Prisma.Decimal(0));
    const hasExactStock = Boolean(resolvedExact);
    const reservedText = hasExactStock && reservedTotal.gt(0) ? this.formatExactQuantityText(reservedTotal, resolvedExact!.unitName) : null;
    const availableQuantity = hasExactStock ? resolvedExact!.quantity.sub(reservedTotal) : null;
    const normalizedAvailableQuantity =
      availableQuantity && availableQuantity.gt(0) ? availableQuantity : hasExactStock ? new Prisma.Decimal(0) : null;
    const availableText = hasExactStock
      ? this.formatExactQuantityText(normalizedAvailableQuantity ?? new Prisma.Decimal(0), resolvedExact!.unitName)
      : stockText;
    const available = hasExactStock ? item.available && (normalizedAvailableQuantity?.gt(0) ?? false) : item.available;

    return {
      id: item.id,
      ingredientId: item.ingredientId,
      categoryName: item.ingredient?.category?.name ?? null,
      name: item.name,
      quantityText: item.quantityText,
      exactQuantity: resolvedExact?.quantity.toString() ?? null,
      exactUnitId: resolvedExact?.unitId ?? null,
      exactUnitName: resolvedExact?.unitName ?? null,
      note: item.note,
      available,
      expireAt: item.expireAt ? toIsoDate(item.expireAt) : null,
      stockText,
      reservedText,
      availableText,
      reservations: reservations.map(reservation => ({
        shoppingListId: reservation.shoppingListId,
        shoppingListName: reservation.shoppingListName,
        shoppingItemId: reservation.shoppingItemId,
        reservedText: this.formatExactQuantityText(reservation.reservedQuantity, reservation.reservedUnitName)
      })),
      updatedAt: toIsoDate(item.updatedAt)
    };
  }

  private buildGapSummary(
    events: GapEvent[],
    fridgeItems: Array<{ name: string }>,
    mode: "ALL" | "EVENT"
  ): ShoppingItemSummary[] {
    const ownedIngredientKeys = new Set(fridgeItems.map(item => item.name.trim().toLowerCase()));
    const gapMap = new Map<string, GapGroup>();

    this.listGapSeeds(events, ownedIngredientKeys).forEach(seed => {
      const groupKey = this.getGapGroupKey(seed, mode);
      const current = gapMap.get(groupKey);

      if (!current) {
        gapMap.set(groupKey, {
          name: seed.ingredientName,
          amount: seed.amount,
          sourceKey: mode === "EVENT" ? this.getEventSourceKey(seed) : groupKey,
          sourceCount: 1,
          sourceTitles: [seed.eventTitle],
          updatedAt: seed.updatedAt
        });
        return;
      }

      current.sourceCount += 1;
      if (!current.sourceTitles.includes(seed.eventTitle)) {
        current.sourceTitles.push(seed.eventTitle);
      }
      if (seed.updatedAt > current.updatedAt) {
        current.updatedAt = seed.updatedAt;
      }
      if (current.amount.kind === "EXACT" && seed.amount.kind === "EXACT") {
        current.amount = {
          ...current.amount,
          quantity: new Prisma.Decimal(current.amount.quantity).add(seed.amount.quantity).toString()
        };
      }
    });

    return Array.from(gapMap.values())
      .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"))
      .map((item, index) => ({
        id: -(index + 1),
        name: item.name,
        quantityText: formatRecipeAmount(item.amount),
        note: mode === "ALL" ? "来自待处理饭局缺口" : "来自饭局菜单缺口",
        sourceCount: item.sourceCount,
        sourceTitles: item.sourceTitles,
        sourceType: "EVENT" as const,
        sourceKey: item.sourceKey,
        status: "OPEN",
        updatedAt: toIsoDate(item.updatedAt)
      }));
  }

  private listGapSeeds(events: GapEvent[], ownedIngredientKeys: Set<string>): GapItemSeed[] {
    return events.flatMap(event => {
      const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
      return menu.ingredients.flatMap((item, index) => {
        if (ownedIngredientKeys.has(item.ingredientName.trim().toLowerCase())) return [];
        return [
          {
            eventId: event.id,
            eventTitle: event.title,
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientName,
            amount: item.amount,
            updatedAt: event.updatedAt,
            index
          }
        ];
      });
    });
  }

  private getEventSourceKey(seed: GapItemSeed) {
    if (seed.amount.kind === "EXACT") {
      return `${seed.eventId}:${seed.ingredientId}:EXACT:${seed.amount.unitId}`;
    }
    return `${seed.eventId}:${seed.ingredientId}:FUZZY:${seed.amount.text}:${seed.index}`;
  }

  private getGapGroupKey(seed: GapItemSeed, mode: "ALL" | "EVENT") {
    if (mode === "EVENT") return this.getEventSourceKey(seed);
    if (seed.amount.kind === "EXACT") {
      return `${seed.ingredientId}:EXACT:${seed.amount.unitId}`;
    }
    return `${seed.eventId}:${seed.ingredientId}:FUZZY:${seed.amount.text}:${seed.index}`;
  }

  private isRecipeShoppingRow(item: ShoppingRow): item is RecipeShoppingRow {
    return (
      item.sourceType === "RECIPE" &&
      item.sourceKey !== null &&
      item.sourceRecipeId !== null &&
      item.sourceRecipeVersionId !== null &&
      item.sourceRecipeTitle !== null &&
      item.sourceBaseServings !== null &&
      item.sourceBatchKey !== null &&
      item.sourceIngredientSort !== null &&
      item.ingredientId !== null &&
      item.amountJson !== null
    );
  }

  private readRecipeAmount(item: RecipeShoppingRow) {
    return fromJson<RecipeAmountSnapshot>(item.amountJson);
  }

  private pushAmount(amountMap: Map<string, ExactAmountGroup>, fuzzyMap: Map<string, number>, amount: RecipeAmountSnapshot) {
    if (amount.kind === "EXACT") {
      const key = `${amount.unitId}`;
      const current = amountMap.get(key);
      if (!current) {
        amountMap.set(key, {
          unitId: amount.unitId,
          unitName: amount.unitName,
          quantity: new Prisma.Decimal(amount.quantity)
        });
        return;
      }
      current.quantity = current.quantity.add(amount.quantity);
      return;
    }

    fuzzyMap.set(amount.text, (fuzzyMap.get(amount.text) ?? 0) + 1);
  }

  private toQuantityLines(amountMap: Map<string, ExactAmountGroup>, fuzzyMap: Map<string, number>) {
    const exactLines = Array.from(amountMap.values())
      .sort((left, right) => left.unitName.localeCompare(right.unitName, "zh-Hans-CN"))
      .map(item => `${item.quantity.toString()}${item.unitName}`);
    const fuzzyLines = Array.from(fuzzyMap.entries())
      .sort((left, right) => left[0].localeCompare(right[0], "zh-Hans-CN"))
      .map(([text, count]) => (count > 1 ? `${text} x${count}` : text));
    return [...exactLines, ...fuzzyLines];
  }

  private getIngredientGroupKey(ingredientId: UUID) {
    return `ingredient:${ingredientId}`;
  }

  private getRecipeGroupKey(recipeId: UUID, sourceVersionId: UUID) {
    return `recipe:${recipeId}:${sourceVersionId}`;
  }

  private getRecipeIngredientGroupKey(recipeId: UUID, sourceVersionId: UUID, ingredientId: UUID) {
    return `recipe:${recipeId}:${sourceVersionId}:ingredient:${ingredientId}`;
  }

  private toShoppingRow(item: {
    id: UUID;
    listId: UUID | null;
    name: string;
    quantityText: string | null;
    note: string | null;
    sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
    sourceKey: string | null;
    sourceRecipeId: UUID | null;
    sourceRecipeVersionId: UUID | null;
    sourceRecipeTitle: string | null;
    sourceBaseServings: number | null;
    sourceBatchKey: string | null;
    sourceIngredientSort: number | null;
    ingredientId: UUID | null;
    amountJson: Prisma.JsonValue | null;
    status: "OPEN" | "BOUGHT" | "DELETED";
    checkedAt: Date | null;
    updatedAt: Date;
  }): ShoppingRow {
    return {
      id: item.id,
      listId: item.listId,
      name: item.name,
      quantityText: item.quantityText,
      note: item.note,
      sourceType: item.sourceType,
      sourceKey: item.sourceKey,
      sourceRecipeId: item.sourceRecipeId,
      sourceRecipeVersionId: item.sourceRecipeVersionId,
      sourceRecipeTitle: item.sourceRecipeTitle,
      sourceBaseServings: item.sourceBaseServings,
      sourceBatchKey: item.sourceBatchKey,
      sourceIngredientSort: item.sourceIngredientSort,
      ingredientId: item.ingredientId,
      amountJson: item.amountJson,
      status: item.status,
      checkedAt: item.checkedAt,
      updatedAt: item.updatedAt
    };
  }

  private toShoppingItemSummary = (item: {
    id: UUID;
    name: string;
    quantityText: string | null;
    note: string | null;
    sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
    sourceKey: string | null;
    status: "OPEN" | "BOUGHT" | "DELETED";
    updatedAt: Date;
  }): ShoppingItemSummary => ({
    id: item.id,
    name: item.name,
    quantityText: item.quantityText,
    note: item.note,
    sourceCount: 1,
    sourceTitles: [],
    sourceType: item.sourceType,
    sourceKey: item.sourceKey,
    status: item.status,
    updatedAt: toIsoDate(item.updatedAt)
  });
}
