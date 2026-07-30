import { createHash, randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma, type DiningGroupStatus, type RecipeStatus } from "@prisma/client";
import type {
  AdminRecipeContentInput,
  AdminDashboardSummary,
  AdminRecipeDetail,
  AdminDeleteUnitResult,
  AdminIngredientCategoryPayloadRequest,
  AdminIngredientRejectReasonCode,
  AdminIngredientCategorySummary,
  AdminIngredientPayloadRequest,
  AdminPendingIngredientSummary,
  AdminReviewPendingIngredientRequest,
  AdminReviewPendingIngredientResult,
  AdminIngredientSummary,
  SetAdminIngredientStatusRequest,
  AdminUnitPayloadRequest,
  AdminUnitSummary,
  AdminResetUserPasswordResponse,
  AdminDiningGroupSummary,
  AdminRecipeSummary,
  AdminUserRecipeDomainOverview,
  CollectionListResponse,
  CollectionSceneSummary,
  CollectedRecipeSummary,
  CreateAdminUserRequest,
  AdminLoginRequest,
  AdminUserEntitlementResponse,
  InspirationCategorySummary,
  MyRecipeSummary,
  PageResult,
  OperationId,
  RecipeCategorySummary,
  RecipeContentSnapshot,
  RecipeDraftSummary,
  RecipeIngredientInput,
  RecipeSceneSummary,
  RecipeReportSummary,
  ReorderItem,
  ResetAdminUserPasswordRequest,
  RelationshipState,
  SetAdminUserStatusRequest,
  StorageUsageSummary,
  UnitSummary,
  UpdateAdminUnitRequest,
  UpdateAdminIngredientCategoryRequest,
  UpdateAdminIngredientRequest,
  UpdateAdminRecipeRequest,
  UpdateAdminUserRequest,
  UserProfile,
  UUID
} from "../../contracts/types";
import { PrismaService } from "../../common/prisma.service";
import {
  completeAdminIdempotentOperation,
  getAdminIdempotentResult,
  startAdminIdempotentOperation
} from "../../common/idempotency";
import { AdminTokenService } from "../../common/security/admin-token.service";
import { hashPassword, verifyPassword } from "../../common/security/password";
import { EntitlementService } from "../entitlement/entitlement.service";
import { buildRecipeSearchText, buildSearchKey, contentSizeBytes, toJson, versionToContent } from "../recipe/recipe-content";
import { IngredientImageService } from "./ingredient-image.service";

function toIsoDate(value: Date) {
  return value.toISOString();
}

const ingredientRejectChoiceMap: Record<AdminIngredientRejectReasonCode, { reason: string; advice: string }> = {
  NAME_NOT_CLEAR: {
    reason: "名称不明确",
    advice: "请改成明确、通用的食材名称后再提交。"
  },
  NAME_HAS_BRAND: {
    reason: "名称含品牌或规格",
    advice: "请去掉品牌、口味、包装规格等描述，保留通用食材名后再提交。"
  },
  CATEGORY_NOT_FIT: {
    reason: "分类不合适",
    advice: "请调整到更合适的系统分类后再提交。"
  },
  UNIT_NOT_FIT: {
    reason: "默认单位不合适",
    advice: "请改成更常用的默认单位后再提交。"
  },
  OUT_OF_SCOPE: {
    reason: "不属于系统食材范围",
    advice: "请确认提交的是可复用的食材本体，而不是菜名、套餐、品牌商品或临时描述。"
  },
  OTHER: {
    reason: "其他",
    advice: "请根据审核意见修改后重新提交。"
  }
};

function toPositiveInt(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return fallback;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toUserProfile(user: {
  id: UUID;
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: user.id,
    uid: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    status: user.status,
    createdAt: toIsoDate(user.createdAt),
    updatedAt: toIsoDate(user.updatedAt)
  };
}

type AdminUserRecipeRow = Prisma.RecipeGetPayload<{
  include: {
    category: true;
    currentVersion: true;
  };
}>;

type AdminRecipeRow = Prisma.RecipeGetPayload<{
  include: {
    owner: { select: { uid: true } };
    category: true;
    inspirationCategory: true;
    currentVersion: true;
  };
}>;

type AdminDraftRow = Prisma.RecipeDraftGetPayload<{
  include: {
    category: true;
  };
}>;

type AdminSceneRow = Prisma.RecipeSceneGetPayload<Record<string, never>>;

type AdminCollectionRow = Prisma.RecipeCollectionGetPayload<{
  include: {
    sourceRecipe: {
      include: {
        inspirationCategory: true;
      };
    };
    sourceVersion: true;
    sceneLinks: {
      include: {
        scene: true;
      };
    };
  };
}>;

type AdminIngredientCategoryRow = Prisma.IngredientCategoryGetPayload<Record<string, never>>;
type AdminIngredientRow = Prisma.IngredientGetPayload<{
  include: {
    category: true;
    defaultUnit: true;
  };
}>;
type AdminIngredientWithImageRow = AdminIngredientRow & { imageUpdatedAt: Date | null };
type AdminPendingIngredientRow = Prisma.IngredientRecommendationGetPayload<{
  include: {
    ingredient: {
      include: {
        owner: {
          select: {
            id: true;
            uid: true;
            nickname: true;
          };
        };
        defaultUnit: true;
      };
    };
  };
}>;

function toRecipeCategorySummary(category: { id: UUID; name: string; version: number }): RecipeCategorySummary {
  return {
    id: category.id,
    name: category.name,
    version: category.version
  };
}

function toRecipeSceneSummary(scene: { id: UUID; name: string; version: number }): RecipeSceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version
  };
}

function toInspirationCategorySummary(category: { id: UUID; name: string; iconKey: string | null }): InspirationCategorySummary {
  return {
    id: category.id,
    name: category.name,
    iconKey: category.iconKey
  };
}

function toCollectionSceneSummary(scene: AdminSceneRow, recipeCount: number, updatedAt: Date | null): CollectionSceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version,
    recipeCount,
    updatedAt: updatedAt ? toIsoDate(updatedAt) : null
  };
}

function isAdminEditableInspiration(recipe: Pick<AdminRecipeRow, "ownerId" | "inspirationCategoryId" | "status">) {
  return recipe.ownerId === null && !!recipe.inspirationCategoryId && recipe.status !== "DELETED";
}

function toUnitSummary(unit: { id: UUID; name: string; type: UnitSummary["type"]; ownerId: UUID | null }): UnitSummary {
  return {
    id: unit.id,
    name: unit.name,
    type: unit.type,
    source: unit.ownerId ? "PERSONAL" : "SYSTEM"
  };
}

function toAdminIngredientCategorySummary(category: AdminIngredientCategoryRow, ingredientCount: number): AdminIngredientCategorySummary {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    isSelectable: category.isSelectable,
    version: category.version,
    ingredientCount,
    updatedAt: toIsoDate(category.updatedAt)
  };
}

function toAdminIngredientSummary(ingredient: AdminIngredientRow): AdminIngredientSummary {
  return {
    id: ingredient.id,
    name: ingredient.name,
    version: ingredient.version,
    status: ingredient.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    categoryId: ingredient.categoryId,
    categoryName: ingredient.category.name,
    defaultUnit: toUnitSummary(ingredient.defaultUnit),
    imageUrl: null,
    updatedAt: toIsoDate(ingredient.updatedAt)
  };
}

function toAdminUnitSummary(unit: { id: UUID; name: string; type: UnitSummary["type"]; version: number; updatedAt: Date }): AdminUnitSummary {
  return {
    id: unit.id,
    name: unit.name,
    type: unit.type,
    source: "SYSTEM",
    version: unit.version,
    updatedAt: toIsoDate(unit.updatedAt)
  };
}

function resolveIngredientReviewNote(body: AdminReviewPendingIngredientRequest) {
  const note = body.reason?.trim() || null;
  if (body.action !== "REJECT") {
    return {
      reviewNote: note,
      reviewAdvice: null,
      reviewReasonCode: null as AdminIngredientRejectReasonCode | null,
      auditReason: note
    };
  }

  if (!body.rejectReasonCode) {
    throw new BadRequestException("请选择拒绝原因");
  }
  const choice = ingredientRejectChoiceMap[body.rejectReasonCode];
  if (!choice) {
    throw new BadRequestException("拒绝原因参数错误");
  }
  if (body.rejectReasonCode === "OTHER") {
    if (!note) {
      throw new BadRequestException("请填写详细拒绝原因");
    }
    return {
      reviewNote: note,
      reviewAdvice: choice.advice,
      reviewReasonCode: body.rejectReasonCode,
      auditReason: note
    };
  }

  return {
    reviewNote: choice.reason,
    reviewAdvice: choice.advice,
    reviewReasonCode: body.rejectReasonCode,
    auditReason: choice.reason
  };
}

function toAdminPendingIngredientSummary(row: AdminPendingIngredientRow): AdminPendingIngredientSummary {
  return {
    id: row.ingredient.id,
    name: row.ingredient.name,
    version: row.ingredient.version,
    categoryId: row.ingredient.categoryId,
    categoryName: row.categoryName,
    defaultUnitId: row.ingredient.defaultUnitId,
    defaultUnitName: row.defaultUnitName,
    status: "PENDING",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    user: {
      id: row.ingredient.owner?.id ?? row.userId,
      uid: row.ingredient.owner?.uid ?? 0,
      nickname: row.ingredient.owner?.nickname ?? null
    }
  };
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AdminTokenService)
    private readonly adminTokenService: AdminTokenService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(IngredientImageService)
    private readonly ingredientImageService: IngredientImageService
  ) {}

  async login(body: AdminLoginRequest) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { username: body.username }
    });

    if (!admin || admin.status !== "ACTIVE" || !verifyPassword(body.password, admin.passwordHash)) {
      throw new UnauthorizedException("用户名或密码错误");
    }

    const token = this.adminTokenService.createToken(admin.id, admin.roles);

    return {
      token: token.token,
      expiresAt: token.expiresAt,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        roles: admin.roles
      }
    };
  }

  async getDashboardSummary(adminId: UUID): Promise<AdminDashboardSummary> {
    await this.requireSuperAdmin(adminId);
    const [
      userTotal,
      userActiveCount,
      userDisabledCount,
      diningGroupTotal,
      diningGroupActiveCount,
      diningGroupMemberCount,
      recipeTotal,
      recipeActiveCount,
      recipeBlockedCount,
      recipeRecycledCount,
      recipeOpenReportCount,
      ingredientCategoryCount,
      ingredientItemCount,
      unitCount
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { status: "DISABLED" } }),
      this.prisma.diningGroup.count(),
      this.prisma.diningGroup.count({ where: { status: "ACTIVE" } }),
      this.prisma.diningGroupMember.count({
        where: { status: { in: ["ACTIVE", "RESTRICTED"] } }
      }),
      this.prisma.recipe.count(),
      this.prisma.recipe.count({ where: { status: "ACTIVE" } }),
      this.prisma.recipe.count({ where: { status: "BLOCKED" } }),
      this.prisma.recipe.count({ where: { status: "RECYCLED" } }),
      this.prisma.recipeReport.count({ where: { status: "OPEN" } }),
      this.prisma.ingredientCategory.count(),
      this.prisma.ingredient.count({ where: { ownerId: null, status: "ACTIVE" } }),
      this.prisma.unit.count({ where: { ownerId: null } })
    ]);

    return {
      user: {
        total: userTotal,
        activeCount: userActiveCount,
        disabledCount: userDisabledCount
      },
      diningGroup: {
        total: diningGroupTotal,
        activeCount: diningGroupActiveCount,
        memberCount: diningGroupMemberCount
      },
      recipe: {
        total: recipeTotal,
        activeCount: recipeActiveCount,
        blockedCount: recipeBlockedCount,
        recycledCount: recipeRecycledCount,
        openReportCount: recipeOpenReportCount
      },
      ingredient: {
        categoryCount: ingredientCategoryCount,
        itemCount: ingredientItemCount,
        unitCount
      }
    };
  }

  async listUsers(page: number, pageSize: number, keyword: string | undefined, adminId: UUID): Promise<PageResult<UserProfile>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword =
      normalizedKeyword && /^\d{1,8}$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where = normalizedKeyword
      ? {
          OR: [
            ...(uidKeyword ? [{ uid: uidKeyword }] : []),
            { nickname: { contains: normalizedKeyword, mode: "insensitive" as const } },
            { phone: { contains: normalizedKeyword, mode: "insensitive" as const } }
          ]
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items.map(user => toUserProfile(user)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createUser(body: CreateAdminUserRequest, adminId: UUID): Promise<UserProfile> {
    await this.requireSuperAdmin(adminId);
    const phone = body.phone.trim();
    const nickname = this.readNickname(body.nickname);
    const status = body.status ?? "ACTIVE";
    const requestHash = `${phone}:${nickname ?? ""}:${status}:${this.hashSecret(body.password)}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<UserProfile>(tx, body.operationId, "admin-user:create", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:create", adminId, requestHash);

      const created = await this.createUserRecord(tx, {
        phone,
        nickname,
        password: body.password,
        status
      });
      const result = toUserProfile(created);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_CREATED",
          objectType: "USER",
          objectId: created.id,
          payload: { phone, status }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-user:create", adminId, requestHash, result);
      return result;
    });
  }

  async updateUser(userId: UUID, body: UpdateAdminUserRequest, adminId: UUID): Promise<UserProfile> {
    await this.requireSuperAdmin(adminId);
    const patch = this.buildUserPatch(body);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("至少提供一个可修改字段");
    }
    const requestHash = `${userId}:${patch.phone ?? ""}:${patch.nickname ?? ""}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<UserProfile>(tx, body.operationId, "admin-user:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:update", adminId, requestHash);

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!current) throw new NotFoundException("用户不存在");

      const updated =
        current.nickname === (patch.nickname === undefined ? current.nickname : patch.nickname) &&
        current.phone === (patch.phone === undefined ? current.phone : patch.phone)
          ? current
          : await this.updateUserRecord(tx, userId, patch);

      const result = toUserProfile(updated);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_UPDATED",
          objectType: "USER",
          objectId: userId,
          payload: patch
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-user:update", adminId, requestHash, result);
      return result;
    });
  }

  async setUserStatus(userId: UUID, body: SetAdminUserStatusRequest, adminId: UUID): Promise<UserProfile> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${userId}:${body.status}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<UserProfile>(
        tx,
        body.operationId,
        "admin-user:set-status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:set-status", adminId, requestHash);

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!current) throw new NotFoundException("用户不存在");

      const updated =
        current.status === body.status
          ? current
          : await tx.user.update({
              where: { id: userId },
              data: {
                status: body.status,
                sessionVersion: { increment: 1 }
              },
              select: {
                id: true,
                uid: true,
                nickname: true,
                avatarUrl: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true
              }
            });

      const result = toUserProfile(updated);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_STATUS_CHANGED",
          objectType: "USER",
          objectId: userId,
          payload: { status: body.status }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-user:set-status", adminId, requestHash, result);
      return result;
    });
  }

  async resetUserPassword(
    userId: UUID,
    body: ResetAdminUserPasswordRequest,
    adminId: UUID
  ): Promise<AdminResetUserPasswordResponse> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${userId}:${this.hashSecret(body.newPassword)}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminResetUserPasswordResponse>(
        tx,
        body.operationId,
        "admin-user:reset-password",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:reset-password", adminId, requestHash);

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!current) throw new NotFoundException("用户不存在");

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashPassword(body.newPassword),
          sessionVersion: { increment: 1 }
        },
        select: {
          id: true,
          updatedAt: true
        }
      });

      const result = {
        userId: updated.id,
        resetAt: toIsoDate(updated.updatedAt)
      } satisfies AdminResetUserPasswordResponse;
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_PASSWORD_RESET",
          objectType: "USER",
          objectId: userId,
          payload: {}
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        body.operationId,
        "admin-user:reset-password",
        adminId,
        requestHash,
        result
      );
      return result;
    });
  }

  async listDiningGroups(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string,
    adminId?: UUID
  ): Promise<PageResult<AdminDiningGroupSummary>> {
    if (!adminId) throw new ForbiddenException("无权执行该操作");
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();

    if (normalizedStatus && !["ACTIVE", "ARCHIVED"].includes(normalizedStatus)) {
      throw new BadRequestException("饭搭子状态参数错误");
    }

    const where: Prisma.DiningGroupWhereInput = {
      ...(keyword ? { name: { contains: keyword, mode: "insensitive" as const } } : {}),
      ...(normalizedStatus ? { status: normalizedStatus as DiningGroupStatus } : {})
    };

    const items = await this.prisma.diningGroup.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: normalizedPageSize,
      include: {
        _count: {
          select: {
            members: {
              where: {
                status: {
                  in: ["ACTIVE", "RESTRICTED"]
                }
              }
            }
          }
        }
      }
    });
    const total = await this.prisma.diningGroup.count({ where });

    return {
      items: items.map(diningGroup => {
        return {
          id: diningGroup.id,
          name: diningGroup.name,
          ownerId: diningGroup.ownerId,
          status: diningGroup.status,
          version: diningGroup.version,
          memberCount: diningGroup._count.members,
          createdAt: toIsoDate(diningGroup.createdAt),
          updatedAt: toIsoDate(diningGroup.updatedAt)
        };
      }),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getUserEntitlements(userId: UUID, adminId: UUID): Promise<AdminUserEntitlementResponse> {
    return this.prisma.$transaction(async tx => {
      const admin = await tx.adminAccount.findUnique({
        where: { id: adminId },
        select: { status: true, roles: true }
      });
      if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
        throw new ForbiddenException("无权查看用户权益");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          status: true
        }
      });
      if (!user) throw new NotFoundException("用户不存在");

      const [resolved, memberships, storageRows] = await Promise.all([
        this.entitlementService.resolveForUser(tx, userId),
        tx.diningGroupMember.findMany({
          where: {
            userId,
            status: { in: ["ACTIVE", "RESTRICTED"] },
            diningGroup: { status: "ACTIVE" }
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          include: {
            diningGroup: {
              include: {
                owner: { select: { uid: true } }
              }
            }
          }
        }),
        tx.storageLedger.findMany({
          where: { userId },
          select: {
            module: true,
            usedBytes: true
          }
        })
      ]);

      const diningGroups = await Promise.all(
        memberships.map(async membership => {
          const memberCount = await tx.diningGroupMember.count({
            where: {
              diningGroupId: membership.diningGroupId,
              status: { in: ["ACTIVE", "RESTRICTED"] }
            }
          });
          const ownerPolicy = await this.entitlementService.resolveForUser(tx, membership.diningGroup.ownerId);
          const state: RelationshipState = memberCount > ownerPolicy.memberLimit ? "OVER_MEMBER_LIMIT" : "NORMAL";

          return {
            id: membership.diningGroup.id,
            name: membership.diningGroup.name,
            ownerUid: membership.diningGroup.owner.uid,
            isOwned: membership.diningGroup.ownerId === userId,
            myRole: membership.role,
            myStatus: membership.status,
            myStatusReason: membership.statusReason,
            memberCount,
            memberLimit: ownerPolicy.memberLimit,
            state,
            version: membership.diningGroup.version,
            createdAt: toIsoDate(membership.diningGroup.createdAt),
            updatedAt: toIsoDate(membership.diningGroup.updatedAt)
          };
        })
      );

      const byModuleMap = new Map<string, number>();
      for (const row of storageRows) {
        byModuleMap.set(row.module, (byModuleMap.get(row.module) ?? 0) + row.usedBytes);
      }
      const usedBytes = Array.from(byModuleMap.values()).reduce((total, value) => total + value, 0);
      const storage: StorageUsageSummary = {
        state: usedBytes > resolved.storageLimitBytes ? "OVER_STORAGE_READONLY" : "NORMAL",
        usedBytes,
        limitBytes: resolved.storageLimitBytes,
        remainingBytes: Math.max(0, resolved.storageLimitBytes - usedBytes),
        byModule: Array.from(byModuleMap.entries()).map(([module, moduleUsedBytes]) => ({
          module: module as AdminUserEntitlementResponse["storage"]["byModule"][number]["module"],
          usedBytes: moduleUsedBytes
        })),
        calculatedAt: toIsoDate(new Date())
      };

      return {
        user: {
          id: user.id,
          uid: user.uid,
          nickname: user.nickname,
          status: user.status
        },
        membership: {
          tier: resolved.tier,
          validUntil: resolved.validUntil
        },
        display: {
          canUseProfileBackground: false,
          canUseHomeBackground: false
        },
        diningGroupUsage: {
          ownedCount: resolved.ownedDiningGroupCount,
          joinedCount: resolved.joinedDiningGroupCount,
          joinLimit: resolved.joinLimit,
          state: resolved.state
        },
        diningGroups,
        storage,
        recipePolicy: {
          recipeLimit: resolved.recipeLimit,
          recycleDays: resolved.recycleDays,
          variantLimitPerRoot: resolved.variantLimitPerRoot
        },
        invitePolicy: {
          inviteLimit: resolved.inviteLimit,
          memberLimit: resolved.memberLimit
        },
        imagePolicy: resolved.imagePolicy
      };
    });
  }

  async getUserRecipeDomain(userId: UUID, adminId: UUID): Promise<AdminUserRecipeDomainOverview> {
    await this.requireSuperAdmin(adminId);
    return this.prisma.$transaction(async tx => {
      const user = await this.requireUser(tx, userId);
      const [publishedCount, draftCount, collectionCount, sceneCount, latestRecipe, latestDraft, latestCollection] = await Promise.all([
        tx.recipe.count({
          where: {
            ownerId: userId,
            status: "ACTIVE"
          }
        }),
        tx.recipeDraft.count({
          where: {
            userId
          }
        }),
        tx.recipeCollection.count({
          where: {
            userId
          }
        }),
        tx.recipeScene.count({
          where: {
            userId
          }
        }),
        tx.recipe.findFirst({
          where: {
            ownerId: userId,
            status: "ACTIVE"
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true }
        }),
        tx.recipeDraft.findFirst({
          where: {
            userId
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true }
        }),
        tx.recipeCollection.findFirst({
          where: {
            userId
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true }
        })
      ]);

      return {
        user: {
          id: user.id,
          uid: user.uid,
          nickname: user.nickname
        },
        publishedCount,
        draftCount,
        collectionCount,
        sceneCount,
        latestPublishedAt: latestRecipe ? toIsoDate(latestRecipe.updatedAt) : null,
        latestDraftAt: latestDraft ? toIsoDate(latestDraft.updatedAt) : null,
        latestCollectionAt: latestCollection ? toIsoDate(latestCollection.updatedAt) : null
      };
    });
  }

  async listUserRecipes(
    userId: UUID,
    adminId: UUID,
    page: number,
    pageSize: number,
    keyword?: string
  ): Promise<PageResult<MyRecipeSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    await this.requireUserExists(userId);

    const where: Prisma.RecipeWhereInput = {
      ownerId: userId,
      status: "ACTIVE",
      ...(keyword
        ? {
            searchText: {
              contains: keyword,
              mode: "insensitive"
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          category: true,
          currentVersion: true
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(item => this.toUserRecipeSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listUserRecipeDrafts(
    userId: UUID,
    adminId: UUID,
    page: number,
    pageSize: number,
    keyword?: string
  ): Promise<PageResult<RecipeDraftSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    await this.requireUserExists(userId);

    const where: Prisma.RecipeDraftWhereInput = {
      userId,
      ...(keyword
        ? {
            searchText: {
              contains: keyword,
              mode: "insensitive"
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeDraft.findMany({
        where,
        include: {
          category: true
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeDraft.count({ where })
    ]);

    return {
      items: items.map(item => this.toUserDraftSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listUserCollections(userId: UUID, adminId: UUID): Promise<CollectionListResponse> {
    await this.requireSuperAdmin(adminId);
    return this.prisma.$transaction(async tx => {
      await this.requireUser(tx, userId);
      const [scenes, collections] = await Promise.all([
        tx.recipeScene.findMany({
          where: { userId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }),
        tx.recipeCollection.findMany({
          where: { userId },
          select: {
            updatedAt: true,
            sceneLinks: {
              select: {
                sceneId: true
              }
            }
          }
        })
      ]);

      const stats = new Map<UUID, { recipeCount: number; updatedAt: Date | null }>();
      for (const scene of scenes) {
        stats.set(scene.id, { recipeCount: 0, updatedAt: null });
      }
      for (const collection of collections) {
        for (const link of collection.sceneLinks) {
          const current = stats.get(link.sceneId);
          if (!current) continue;
          current.recipeCount += 1;
          current.updatedAt =
            !current.updatedAt || collection.updatedAt > current.updatedAt ? collection.updatedAt : current.updatedAt;
        }
      }

      return {
        items: scenes.map(scene => {
          const current = stats.get(scene.id) ?? { recipeCount: 0, updatedAt: null };
          return toCollectionSceneSummary(scene, current.recipeCount, current.updatedAt);
        }),
        totalCount: collections.length
      };
    });
  }

  async listUserCollectionRecipes(
    userId: UUID,
    sceneId: UUID,
    adminId: UUID,
    page: number,
    pageSize: number
  ): Promise<PageResult<CollectedRecipeSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;

    return this.prisma.$transaction(async tx => {
      await this.requireUser(tx, userId);
      const scene = await tx.recipeScene.findFirst({
        where: {
          id: sceneId,
          userId
        },
        select: { id: true }
      });
      if (!scene) throw new NotFoundException("合集不存在");

      const where: Prisma.RecipeCollectionWhereInput = {
        userId,
        sceneLinks: {
          some: {
            sceneId
          }
        }
      };
      const [items, total] = await Promise.all([
        tx.recipeCollection.findMany({
          where,
          include: {
            sourceRecipe: {
              include: {
                inspirationCategory: true
              }
            },
            sourceVersion: true,
            sceneLinks: {
              include: {
                scene: true
              }
            }
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip,
          take: normalizedPageSize
        }),
        tx.recipeCollection.count({ where })
      ]);

      return {
        items: items.map(item => this.toCollectedRecipeSummary(item)),
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        hasNext: skip + items.length < total
      };
    });
  }

  async listIngredientCategories(keyword: string | undefined, adminId: UUID): Promise<AdminIngredientCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const normalizedKeyword = keyword?.trim();
    const where: Prisma.IngredientCategoryWhereInput = normalizedKeyword
      ? {
          name: {
            contains: normalizedKeyword,
            mode: "insensitive"
          }
        }
      : {};
    const categories = await this.prisma.ingredientCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    if (!categories.length) return [];

    const counts = await this.prisma.ingredient.groupBy({
      by: ["categoryId"],
      where: {
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED"]
        },
        categoryId: {
          in: categories.map(item => item.id)
        }
      },
      _count: {
        _all: true
      }
    });
    const countMap = new Map(counts.map(item => [item.categoryId, item._count._all]));
    return categories.map(category => toAdminIngredientCategorySummary(category, countMap.get(category.id) ?? 0));
  }

  async listSystemUnits(adminId: UUID): Promise<AdminUnitSummary[]> {
    await this.requireSuperAdmin(adminId);
    const items = await this.prisma.unit.findMany({
      where: {
        ownerId: null
      },
      orderBy: [{ type: "asc" }, { systemSortOrder: "asc" }, { name: "asc" }]
    });
    return items.map(toAdminUnitSummary);
  }

  async createSystemUnit(body: AdminUnitPayloadRequest, adminId: UUID): Promise<AdminUnitSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const requestHash = `${body.type}:${searchKey}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminUnitSummary>(
          tx,
          body.operationId,
          "admin-unit:create",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-unit:create", adminId, requestHash);
        await this.assertSystemUnitNameAvailable(tx, searchKey, null);
        const systemSortOrder = await this.nextSystemUnitSortOrder(tx, body.type);
        const unit = await tx.unit.create({
          data: {
            ownerId: null,
            type: body.type,
            name,
            searchKey,
            systemSortOrder
          }
        });
        const result = toAdminUnitSummary(unit);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "UNIT_CREATED",
            objectType: "UNIT",
            objectId: unit.id,
            payload: {
              name,
              type: body.type,
              source: "SYSTEM"
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-unit:create", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统单位名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async updateSystemUnit(unitId: UUID, body: UpdateAdminUnitRequest, adminId: UUID): Promise<AdminUnitSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const requestHash = `${unitId}:${body.expectedVersion}:${body.type}:${searchKey}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminUnitSummary>(
          tx,
          body.operationId,
          "admin-unit:update",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-unit:update", adminId, requestHash);
        const unit = await this.requireSystemUnit(tx, unitId);
        if (unit.version !== body.expectedVersion) throw new ConflictException("单位已被更新，请刷新后重试");
        await this.assertSystemUnitNameAvailable(tx, searchKey, unitId);
        const systemSortOrder =
          unit.type === body.type ? unit.systemSortOrder : await this.nextSystemUnitSortOrder(tx, body.type);
        const updated = await tx.unit.update({
          where: { id: unitId },
          data: {
            name,
            type: body.type,
            searchKey,
            systemSortOrder,
            version: { increment: 1 }
          }
        });
        const result = toAdminUnitSummary(updated);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "UNIT_UPDATED",
            objectType: "UNIT",
            objectId: unitId,
            payload: {
              name,
              type: body.type,
              source: "SYSTEM"
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-unit:update", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统单位名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async deleteSystemUnit(unitId: UUID, operationId: OperationId, expectedVersion: number, adminId: UUID): Promise<AdminDeleteUnitResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${unitId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteUnitResult>(
        tx,
        operationId,
        "admin-unit:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-unit:delete", adminId, requestHash);
      const unit = await this.requireSystemUnit(tx, unitId);
      if (unit.version !== expectedVersion) throw new ConflictException("单位已被更新，请刷新后重试");

      const ingredientCount = await tx.ingredient.count({
        where: {
          defaultUnitId: unitId,
          status: {
            in: ["ACTIVE", "DISABLED"]
          }
        }
      });
      if (ingredientCount > 0) throw new ConflictException("该单位已被食材使用，不能删除");
      if (await this.hasDraftUnitReference(tx, unitId)) {
        throw new ConflictException("该单位仍被菜谱草稿使用，不能删除");
      }
      if (await this.hasRecipeVersionUnitReference(tx, unitId)) {
        throw new ConflictException("该单位仍被已发布菜谱使用，不能删除");
      }

      await tx.unit.delete({
        where: { id: unitId }
      });
      const result = {
        unitId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "UNIT_DELETED",
          objectType: "UNIT",
          objectId: unitId,
          payload: {
            name: unit.name,
            type: unit.type,
            source: "SYSTEM"
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-unit:delete", adminId, requestHash, result);
      return result;
    });
  }

  async reorderSystemUnits(type: UnitSummary["type"], operationId: OperationId, items: ReorderItem[], adminId: UUID): Promise<AdminUnitSummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ type, items });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminUnitSummary[]>(
        tx,
        operationId,
        "admin-unit:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-unit:reorder", adminId, requestHash);

      const all = await tx.unit.findMany({
        where: {
          ownerId: null,
          type
        },
        orderBy: [{ systemSortOrder: "asc" }, { createdAt: "asc" }]
      });
      this.assertReorderScope(all, items, "系统单位");
      await this.writeSystemUnitSortOrder(tx, type, items.map(item => item.id));

      const updated = await tx.unit.findMany({
        where: {
          ownerId: null
        },
        orderBy: [{ type: "asc" }, { systemSortOrder: "asc" }, { name: "asc" }]
      });
      const result = updated.map(toAdminUnitSummary);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "UNIT_REORDERED",
          objectType: "UNIT_TYPE",
          objectId: null,
          payload: {
            type,
            ids: items.map(item => item.id),
            source: "SYSTEM"
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-unit:reorder", adminId, requestHash, result);
      return result;
    });
  }

  async createIngredientCategory(body: AdminIngredientCategoryPayloadRequest, adminId: UUID): Promise<AdminIngredientCategorySummary> {
    await this.requireSuperAdmin(adminId);
    void body;
    throw new ConflictException("系统食材分类已固定，当前不支持新增分类");
  }

  async updateIngredientCategory(
    categoryId: UUID,
    body: UpdateAdminIngredientCategoryRequest,
    adminId: UUID
  ): Promise<AdminIngredientCategorySummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const requestHash = `${categoryId}:${body.expectedVersion}:${name}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientCategorySummary>(
        tx,
        body.operationId,
        "admin-ingredient-category:update",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-category:update", adminId, requestHash);

      const category = await this.requireIngredientCategory(tx, categoryId);
      if (category.version !== body.expectedVersion) throw new ConflictException("食材分类已被更新，请刷新后重试");
      await this.assertIngredientCategoryNameAvailable(tx, name, categoryId);

      const updated = await tx.ingredientCategory.update({
        where: { id: categoryId },
        data: {
          name,
          version: { increment: 1 }
        }
      });
      const ingredientCount = await tx.ingredient.count({
        where: {
          ownerId: null,
          status: {
            in: ["ACTIVE", "DISABLED"]
          },
          categoryId
        }
      });
      const result = toAdminIngredientCategorySummary(updated, ingredientCount);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_CATEGORY_UPDATED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: categoryId,
          payload: { name }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-category:update", adminId, requestHash, result);
      return result;
    });
  }

  async reorderIngredientCategories(
    operationId: OperationId,
    items: ReorderItem[],
    adminId: UUID
  ): Promise<AdminIngredientCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify(items);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientCategorySummary[]>(
        tx,
        operationId,
        "admin-ingredient-category:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient-category:reorder", adminId, requestHash);

      const all = await tx.ingredientCategory.findMany({
        orderBy: { sortOrder: "asc" }
      });
      this.assertReorderScope(all, items, "食材分类");
      await this.writeIngredientCategorySortOrder(tx, items.map(item => item.id));

      const [updated, counts] = await Promise.all([
        tx.ingredientCategory.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }),
        tx.ingredient.groupBy({
          by: ["categoryId"],
          where: { ownerId: null, status: "ACTIVE" },
          _count: { _all: true }
        })
      ]);
      const countMap = new Map(counts.map(item => [item.categoryId, item._count._all]));
      const result = updated.map(category => toAdminIngredientCategorySummary(category, countMap.get(category.id) ?? 0));
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_CATEGORY_REORDERED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: updated[0]?.id ?? null,
          payload: { ids: items.map(item => item.id) }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient-category:reorder", adminId, requestHash, result);
      return result;
    });
  }

  async listIngredients(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    page: number,
    pageSize: number,
    categoryId: UUID | undefined,
    keyword: string | undefined,
    status: string | undefined,
    adminId: UUID
  ): Promise<PageResult<AdminIngredientSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const normalizedStatus = status === "DISABLED" || status === "ALL" ? status : "ACTIVE";
    const where: Prisma.IngredientWhereInput = {
      ownerId: null,
      status:
        normalizedStatus === "ALL"
          ? {
              in: ["ACTIVE", "DISABLED"]
            }
          : normalizedStatus,
      ...(categoryId ? { categoryId } : {}),
      ...(normalizedKeyword
        ? {
            searchKey: {
              contains: buildSearchKey(normalizedKeyword)
            }
          }
        : {})
    };
    const orderBy = categoryId
      ? ([{ systemSortOrder: "asc" }, { createdAt: "asc" }] satisfies Prisma.IngredientOrderByWithRelationInput[])
      : ([{ category: { sortOrder: "asc" } }, { systemSortOrder: "asc" }, { createdAt: "asc" }] satisfies Prisma.IngredientOrderByWithRelationInput[]);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredient.findMany({
        where,
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy,
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredient.count({ where })
    ]);
    return {
      items: items.map(item => ({
        ...toAdminIngredientSummary(item),
        imageUrl: this.ingredientImageService.buildImageUrl(request, item.id, (item as AdminIngredientWithImageRow).imageUpdatedAt)
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createIngredient(body: AdminIngredientPayloadRequest, adminId: UUID): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const requestHash = `${searchKey}:${body.categoryId}:${body.defaultUnitId}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          body.operationId,
          "admin-ingredient:create",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:create", adminId, requestHash);

        await this.requireSelectableIngredientCategory(tx, body.categoryId);
        const unit = await this.requireSystemUnit(tx, body.defaultUnitId);
        await this.assertSystemIngredientNameAvailable(tx, searchKey, null);
        const systemSortOrder = await this.nextSystemIngredientSortOrder(tx, body.categoryId);
        const ingredient = await tx.ingredient.create({
          data: {
            ownerId: null,
            status: "ACTIVE",
            categoryId: body.categoryId,
            defaultUnitId: unit.id,
            name,
            searchKey,
            systemSortOrder
          },
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = toAdminIngredientSummary(ingredient);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_CREATED",
            objectType: "INGREDIENT",
            objectId: ingredient.id,
            payload: { categoryId: body.categoryId, name }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:create", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称或排序已冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async updateIngredient(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    body: UpdateAdminIngredientRequest,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const requestHash = `${ingredientId}:${body.expectedVersion}:${searchKey}:${body.categoryId}:${body.defaultUnitId}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          body.operationId,
          "admin-ingredient:update",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:update", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== body.expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");
        await this.requireSelectableIngredientCategory(tx, body.categoryId);
        const unit = await this.requireSystemUnit(tx, body.defaultUnitId);
        await this.assertSystemIngredientNameAvailable(tx, searchKey, ingredientId);
        const systemSortOrder =
          ingredient.categoryId === body.categoryId
            ? ingredient.systemSortOrder
            : await this.nextSystemIngredientSortOrder(tx, body.categoryId);

        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            name,
            searchKey,
            categoryId: body.categoryId,
            defaultUnitId: unit.id,
            systemSortOrder,
            version: { increment: 1 }
          },
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated),
          imageUrl: this.ingredientImageService.buildImageUrl(
            request,
            updated.id,
            (updated as AdminIngredientWithImageRow).imageUpdatedAt
          )
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_UPDATED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              categoryId: body.categoryId,
              name
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:update", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称或排序已冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async setIngredientStatus(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    body: SetAdminIngredientStatusRequest,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${ingredientId}:${body.expectedVersion}:${body.status}`;

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          body.operationId,
          "admin-ingredient:set-status",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:set-status", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== body.expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

        const updated =
          ingredient.status === body.status
            ? ingredient
            : await tx.ingredient.update({
                where: { id: ingredientId },
                data: {
                  status: body.status,
                  systemSortOrder:
                    body.status === "ACTIVE" ? await this.nextSystemIngredientSortOrder(tx, ingredient.categoryId) : ingredient.systemSortOrder,
                  version: { increment: 1 }
                },
                include: {
                  category: true,
                  defaultUnit: true
                }
              });

        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: this.ingredientImageService.buildImageUrl(
            request,
            updated.id,
            (updated as AdminIngredientWithImageRow).imageUpdatedAt
          )
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_STATUS_CHANGED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              status: body.status
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:set-status", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材排序已更新，请刷新后重试");
      }
      throw error;
    }
  }

  async uploadIngredientImage(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    file: { buffer?: Buffer; size?: number } | undefined,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const fileHash = file?.buffer ? createHash("sha256").update(file.buffer).digest("hex") : "missing";
    const requestHash = `${ingredientId}:${expectedVersion}:${fileHash}`;
    const stagedImagePath = await this.ingredientImageService.stageImageUpload(ingredientId, file);
    let backupImagePath: string | null = null;
    let replaced = false;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          operationId,
          "admin-ingredient:upload-image",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:upload-image", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

        backupImagePath = await this.ingredientImageService.replaceStagedImage(ingredientId, stagedImagePath);
        replaced = true;

        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            imageUpdatedAt: new Date(),
            version: { increment: 1 }
          } as Prisma.IngredientUpdateInput,
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: this.ingredientImageService.buildImageUrl(
            request,
            updated.id,
            (updated as AdminIngredientWithImageRow).imageUpdatedAt
          )
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_IMAGE_UPDATED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              fileHash
            }
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:upload-image", adminId, requestHash, result);
        return result;
      });

      if (replaced) {
        await this.ingredientImageService.finalizeReplacedImage(backupImagePath);
      } else {
        await this.ingredientImageService.discardStagedImage(stagedImagePath);
      }

      return result;
    } catch (error) {
      if (replaced) {
        await this.ingredientImageService.rollbackReplacedImage(ingredientId, backupImagePath);
      } else {
        await this.ingredientImageService.discardStagedImage(stagedImagePath);
      }
      throw error;
    }
  }

  async clearIngredientImage(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${ingredientId}:${expectedVersion}:clear`;
    let backupImagePath: string | null = null;
    let cleared = false;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          operationId,
          "admin-ingredient:clear-image",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:clear-image", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

        backupImagePath = await this.ingredientImageService.stageClearImage(ingredientId);
        cleared = true;

        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            imageUpdatedAt: null,
            version: { increment: 1 }
          } as Prisma.IngredientUpdateInput,
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: null
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_IMAGE_CLEARED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {}
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:clear-image", adminId, requestHash, result);
        return result;
      });

      if (cleared) {
        await this.ingredientImageService.finalizeClearedImage(backupImagePath);
      }

      return result;
    } catch (error) {
      if (cleared) {
        await this.ingredientImageService.rollbackClearedImage(ingredientId, backupImagePath);
      }
      throw error;
    }
  }

  async reorderIngredients(
    categoryId: UUID,
    operationId: OperationId,
    items: ReorderItem[],
    adminId: UUID
  ): Promise<AdminIngredientSummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ categoryId, items });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientSummary[]>(
        tx,
        operationId,
        "admin-ingredient:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:reorder", adminId, requestHash);

      await this.requireIngredientCategory(tx, categoryId);
      const all = await tx.ingredient.findMany({
        where: {
          ownerId: null,
          status: "ACTIVE",
          categoryId
        },
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy: [{ systemSortOrder: "asc" }, { createdAt: "asc" }]
      });
      this.assertReorderScope(all, items, "系统食材");
      await this.writeSystemIngredientSortOrder(tx, items.map(item => item.id), categoryId);

      const updated = await tx.ingredient.findMany({
        where: {
          ownerId: null,
          status: "ACTIVE",
          categoryId
        },
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy: [{ systemSortOrder: "asc" }, { createdAt: "asc" }]
      });
      const result = updated.map(toAdminIngredientSummary);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_REORDERED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: categoryId,
          payload: { ids: items.map(item => item.id) }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:reorder", adminId, requestHash, result);
      return result;
    });
  }

  async listPendingIngredients(page: number, pageSize: number, keyword: string | undefined, adminId: UUID): Promise<PageResult<AdminPendingIngredientSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword = normalizedKeyword && /^\d+$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where: Prisma.IngredientRecommendationWhereInput = {
      status: "PENDING",
      ingredient: {
        is: {
          ownerId: {
            not: null
          },
          status: "ACTIVE"
        }
      },
      ...(normalizedKeyword
        ? {
            OR: [
              { ingredientName: { contains: normalizedKeyword, mode: "insensitive" } },
              { categoryName: { contains: normalizedKeyword, mode: "insensitive" } },
              { user: { is: { nickname: { contains: normalizedKeyword, mode: "insensitive" } } } },
              ...(uidKeyword === null ? [] : [{ ingredient: { is: { owner: { is: { uid: uidKeyword } } } } }])
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredientRecommendation.findMany({
        where,
        include: {
          ingredient: {
            include: {
              owner: {
                select: {
                  id: true,
                  uid: true,
                  nickname: true
                }
              },
              defaultUnit: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredientRecommendation.count({ where })
    ]);

    return {
      items: items.map(toAdminPendingIngredientSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async reviewPendingIngredient(
    _request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    body: AdminReviewPendingIngredientRequest,
    adminId: UUID
  ): Promise<AdminReviewPendingIngredientResult> {
    await this.requireSuperAdmin(adminId);
    const reviewContent = resolveIngredientReviewNote(body);
    const requestHash = JSON.stringify({
      ingredientId,
      ...body,
      reason: reviewContent.reviewNote,
      reviewAdvice: reviewContent.reviewAdvice,
      reviewReasonCode: reviewContent.reviewReasonCode
    });
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
        const recommendation = await this.requirePendingIngredientRecommendation(tx, ingredientId);
        const repeated = await getAdminIdempotentResult<AdminReviewPendingIngredientResult>(
          tx,
          body.operationId,
          "admin-pending-ingredient:review",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        if (recommendation.ingredient.version !== body.expectedVersion) {
          throw new ConflictException("食材已被更新，请刷新后重试");
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash);

        const now = new Date();
        if (body.action === "REJECT") {
          await tx.ingredientRecommendation.update({
            where: { id: recommendation.id },
            data: {
              status: "REJECTED",
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: reviewContent.reviewReasonCode,
              reviewAdvice: reviewContent.reviewAdvice,
              reviewedAt: now
            }
          });
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "INGREDIENT_RECOMMENDATION_REVIEWED",
              objectType: "INGREDIENT",
              objectId: ingredientId,
              payload: {
                action: body.action,
                targetIngredientId: null,
                rejectReasonCode: reviewContent.reviewReasonCode,
                reason: reviewContent.auditReason,
                advice: reviewContent.reviewAdvice
              }
            },
          });
          const result = {
            id: ingredientId,
            status: "REJECTED",
            reviewedAt: toIsoDate(now),
            targetIngredientId: null
          } satisfies AdminReviewPendingIngredientResult;
          await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash, result);
          return result;
        }

        const name = body.name?.trim() || "";
        if (!name) throw new BadRequestException("食材名称不能为空");
        if (!body.categoryId) throw new BadRequestException("请选择分类");
        if (!body.defaultUnitId) throw new BadRequestException("请选择默认单位");
        const searchKey = buildSearchKey(name);
        const category = await this.requireSelectableIngredientCategory(tx, body.categoryId);
        const unit = await this.requireSystemUnit(tx, body.defaultUnitId);

        let targetIngredientId: UUID | null = null;

        if (body.action === "APPROVE_MERGE") {
          if (!body.targetIngredientId) throw new BadRequestException("请选择归并目标");
          const mergeTarget = await this.requireSystemIngredient(tx, body.targetIngredientId);
          await this.assertSystemIngredientNameAvailable(tx, searchKey, mergeTarget.id);
          const nextSortOrder =
            mergeTarget.categoryId === body.categoryId
              ? mergeTarget.systemSortOrder
              : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
          const updatedTarget = await tx.ingredient.update({
            where: { id: mergeTarget.id },
            data: {
              name,
              searchKey,
              categoryId: body.categoryId,
              defaultUnitId: unit.id,
              systemSortOrder: nextSortOrder,
              version: { increment: 1 }
            },
            include: {
              category: true,
              defaultUnit: true
            }
          });
          await tx.ingredient.update({
            where: { id: ingredientId },
            data: {
              status: "MERGED",
              mergedToId: updatedTarget.id,
              version: { increment: 1 }
            }
          });
          await tx.ingredientRecommendation.update({
            where: { id: recommendation.id },
            data: {
              status: "MERGED",
              ingredientName: updatedTarget.name,
              categoryId: updatedTarget.categoryId,
              categoryName: category.name,
              defaultUnitId: updatedTarget.defaultUnitId,
              defaultUnitName: updatedTarget.defaultUnit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedTarget.id,
              reviewedAt: now
            }
          });
          targetIngredientId = updatedTarget.id;
        } else {
          const duplicate = await tx.ingredient.findFirst({
            where: {
              ownerId: null,
              status: {
                in: ["ACTIVE", "DISABLED"]
              },
              searchKey,
            },
            include: {
              category: true,
              defaultUnit: true
            }
          });

          if (duplicate) {
            const nextSortOrder =
              duplicate.categoryId === body.categoryId
                ? duplicate.systemSortOrder
                : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
            const updatedTarget = await tx.ingredient.update({
              where: { id: duplicate.id },
              data: {
                status: "ACTIVE",
                name,
                searchKey,
                categoryId: body.categoryId,
                defaultUnitId: unit.id,
                systemSortOrder: nextSortOrder,
                version: { increment: 1 }
              },
              include: {
                category: true,
                defaultUnit: true
              }
            });
            await tx.ingredient.update({
              where: { id: ingredientId },
              data: {
                status: "MERGED",
                mergedToId: updatedTarget.id,
                version: { increment: 1 }
              }
            });
            await tx.ingredientRecommendation.update({
              where: { id: recommendation.id },
            data: {
              status: "MERGED",
              ingredientName: updatedTarget.name,
              categoryId: updatedTarget.categoryId,
              categoryName: category.name,
              defaultUnitId: updatedTarget.defaultUnitId,
              defaultUnitName: updatedTarget.defaultUnit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedTarget.id,
              reviewedAt: now
            }
          });
            targetIngredientId = updatedTarget.id;
          } else {
            const current = recommendation.ingredient;
            const nextSortOrder =
              current.categoryId === body.categoryId && current.ownerId === null
                ? current.systemSortOrder
                : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
            const updatedIngredient = await tx.ingredient.update({
              where: { id: ingredientId },
              data: {
                ownerId: null,
                status: "ACTIVE",
                mergedToId: null,
                name,
                searchKey,
                categoryId: body.categoryId,
                defaultUnitId: unit.id,
                systemSortOrder: nextSortOrder,
                version: { increment: 1 }
              },
              include: {
                category: true,
                defaultUnit: true
              }
            });
            await tx.ingredientRecommendation.update({
              where: { id: recommendation.id },
            data: {
              status: "ADOPTED",
              ingredientName: updatedIngredient.name,
              categoryId: updatedIngredient.categoryId,
              categoryName: category.name,
              defaultUnitId: updatedIngredient.defaultUnitId,
              defaultUnitName: updatedIngredient.defaultUnit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedIngredient.id,
              reviewedAt: now
            }
          });
            targetIngredientId = updatedIngredient.id;
          }
        }

        const result = {
          id: ingredientId,
          status: "APPROVED",
          reviewedAt: toIsoDate(now),
          targetIngredientId
        } satisfies AdminReviewPendingIngredientResult;
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_RECOMMENDATION_REVIEWED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              action: body.action,
              targetIngredientId,
              reason: reviewContent.auditReason
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称或排序已冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async listRecipes(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string,
    adminId?: UUID
  ): Promise<PageResult<AdminRecipeSummary>> {
    if (!adminId) throw new ForbiddenException("无权执行该操作");
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();

    if (normalizedStatus && !["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"].includes(normalizedStatus)) {
      throw new BadRequestException("菜谱状态参数错误");
    }

    const where: Prisma.RecipeWhereInput = {
      ...(keyword
        ? {
            searchText: {
              contains: keyword,
              mode: "insensitive"
            }
          }
        : {}),
      ...(normalizedStatus ? { status: normalizedStatus as RecipeStatus } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: {
            select: { uid: true }
          }
        },
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(recipe => this.toAdminRecipeSummary(recipe)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getRecipeDetail(recipeId: UUID, adminId: UUID): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        owner: {
          select: { uid: true }
        },
        category: true,
        inspirationCategory: true,
        currentVersion: true
      }
    });
    if (!recipe) throw new NotFoundException("菜谱不存在");
    return this.toAdminRecipeDetail(recipe);
  }

  async listRecipeReports(page: number, pageSize: number, status: string | undefined, adminId: UUID): Promise<PageResult<RecipeReportSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();
    if (normalizedStatus && !["OPEN", "RESOLVED"].includes(normalizedStatus)) {
      throw new BadRequestException("举报状态参数错误");
    }

    const where: Prisma.RecipeReportWhereInput = normalizedStatus ? { status: normalizedStatus as "OPEN" | "RESOLVED" } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeReport.findMany({
        where,
        include: {
          reporter: {
            select: { uid: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeReport.count({ where })
    ]);

    return {
      items: items.map(report => ({
        id: report.id,
        recipeId: report.recipeId,
        reporterUid: report.reporter.uid,
        reason: report.reason,
        status: report.status,
        createdAt: toIsoDate(report.createdAt)
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async updateRecipe(recipeId: UUID, adminId: UUID, body: UpdateAdminRecipeRequest): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({
      recipeId,
      expectedVersion: body.expectedVersion,
      inspirationCategoryId: body.inspirationCategoryId,
      content: body.content
    });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeDetail>(tx, body.operationId, "admin-recipe:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe:update", adminId, requestHash);

      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: {
          owner: {
            select: { uid: true }
          },
          category: true,
          inspirationCategory: true,
          currentVersion: true
        }
      });
      if (!recipe || recipe.ownerId !== null || !recipe.inspirationCategoryId) {
        throw new NotFoundException("灵感菜谱不存在");
      }
      if (recipe.status === "DELETED") {
        throw new ConflictException("已删除菜谱不支持编辑");
      }
      if (recipe.version !== body.expectedVersion) {
        throw new ConflictException("菜谱版本已更新，请刷新后重试");
      }

      const inspirationCategory = await tx.inspirationCategory.findUnique({
        where: { id: body.inspirationCategoryId }
      });
      if (!inspirationCategory) throw new NotFoundException("灵感分类不存在");

      const content = await this.buildAdminRecipeContent(tx, body.content);
      this.assertAdminRecipeContent(content);

      const nextVersion = await tx.recipeContentVersion.create({
        data: this.buildAdminRecipeVersionCreateInput(content)
      });

      const updated = await tx.recipe.update({
        where: { id: recipeId },
        data: {
          currentVersionId: nextVersion.id,
          title: content.name,
          searchText: buildRecipeSearchText(content),
          inspirationCategoryId: inspirationCategory.id,
          version: { increment: 1 }
        },
        include: {
          owner: {
            select: { uid: true }
          },
          category: true,
          inspirationCategory: true,
          currentVersion: true
        }
      });

      const result = this.toAdminRecipeDetail(updated);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_UPDATED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: {
            previousVersionId: recipe.currentVersionId,
            nextVersionId: nextVersion.id,
            inspirationCategoryId: inspirationCategory.id
          }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-recipe:update", adminId, requestHash, result);
      return result;
    });
  }

  async blockRecipe(recipeId: UUID, adminId: UUID, operationId: OperationId, reason: string) {
    await this.requireSuperAdmin(adminId);
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException("下架原因不能为空");
    const requestHash = `${recipeId}:${normalizedReason}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeSummary>(
        tx,
        operationId,
        "admin-recipe:block",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe:block", adminId, requestHash);

      const changed = await tx.recipe.updateMany({
        where: { id: recipeId, status: "ACTIVE" },
        data: {
          status: "BLOCKED",
          blockedReason: normalizedReason,
          blockedAt: new Date()
        }
      });
      if (changed.count === 0) throw new ConflictException("只有正常菜谱可以下架");
      const recipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: { owner: { select: { uid: true } } }
      });
      const result = this.toAdminRecipeSummary(recipe);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_BLOCKED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: { reason: normalizedReason }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe:block", adminId, requestHash, result);
      return result;
    });
  }

  async unblockRecipe(recipeId: UUID, adminId: UUID, operationId: OperationId) {
    await this.requireSuperAdmin(adminId);
    const requestHash = String(recipeId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeSummary>(
        tx,
        operationId,
        "admin-recipe:unblock",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe:unblock", adminId, requestHash);

      const changed = await tx.recipe.updateMany({
        where: { id: recipeId, status: "BLOCKED" },
        data: {
          status: "ACTIVE",
          blockedReason: null,
          blockedAt: null
        }
      });
      if (changed.count === 0) throw new ConflictException("只有已下架菜谱可以恢复");
      const recipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: { owner: { select: { uid: true } } }
      });
      const result = this.toAdminRecipeSummary(recipe);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_UNBLOCKED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: {}
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe:unblock", adminId, requestHash, result);
      return result;
    });
  }

  async resolveRecipeReport(reportId: UUID, adminId: UUID, operationId: OperationId, resolutionNote?: string | null) {
    await this.requireSuperAdmin(adminId);
    const note = resolutionNote?.trim() || null;
    const requestHash = `${reportId}:${note ?? ""}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<RecipeReportSummary>(
        tx,
        operationId,
        "admin-recipe-report:resolve",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-report:resolve", adminId, requestHash);

      const changed = await tx.recipeReport.updateMany({
        where: { id: reportId, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolutionNote: note,
          resolvedAt: new Date()
        }
      });
      if (changed.count === 0) throw new ConflictException("只有待处理举报可以处理");
      const report = await tx.recipeReport.findUniqueOrThrow({
        where: { id: reportId },
        include: { reporter: { select: { uid: true } } }
      });
      const result = {
        id: report.id,
        recipeId: report.recipeId,
        reporterUid: report.reporter.uid,
        reason: report.reason,
        status: report.status,
        createdAt: toIsoDate(report.createdAt)
      } satisfies RecipeReportSummary;
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_REPORT_RESOLVED",
          objectType: "RECIPE_REPORT",
          objectId: reportId,
          payload: { recipeId: report.recipeId, resolutionNote: note }
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        operationId,
        "admin-recipe-report:resolve",
        adminId,
        requestHash,
        result
      );
      return result;
    });
  }

  private toAdminRecipeSummary(recipe: {
    id: UUID;
    title: string;
    coverImageUrl: string | null;
    status: RecipeStatus;
    updatedAt: Date;
    owner?: { uid: number } | null;
  }): AdminRecipeSummary {
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      status: recipe.status,
      updatedAt: toIsoDate(recipe.updatedAt),
      ownerUid: recipe.owner?.uid ?? null
    };
  }

  private toAdminRecipeDetail(recipe: AdminRecipeRow): AdminRecipeDetail {
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      status: recipe.status,
      ownerUid: recipe.owner?.uid ?? null,
      personalCategory: recipe.category ? toRecipeCategorySummary(recipe.category) : null,
      inspirationCategory: recipe.inspirationCategory ? toInspirationCategorySummary(recipe.inspirationCategory) : null,
      contentVersionId: recipe.currentVersionId,
      content: versionToContent(recipe.currentVersion),
      version: recipe.version,
      reportCount: recipe.reportCount,
      blockedReason: recipe.blockedReason,
      likeCount: recipe.likeCount,
      collectCount: recipe.collectCount,
      canEdit: isAdminEditableInspiration(recipe),
      createdAt: toIsoDate(recipe.createdAt),
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private assertAdminRecipeContent(content: RecipeContentSnapshot) {
    if (!content.name.trim()) throw new BadRequestException("菜谱名称不能为空");
    if (content.baseServings < 1 || content.baseServings > 20) {
      throw new BadRequestException("基准人数必须为 1 到 20");
    }
    if (content.ingredients.length === 0) throw new BadRequestException("至少需要一个食材");
    if (!content.steps.some(item => item.text.trim())) throw new BadRequestException("至少需要一个制作步骤");
    for (const item of content.ingredients) {
      if (item.amount.kind === "EXACT") {
        if (!item.amount.quantity.trim() || Number(item.amount.quantity) <= 0) {
          throw new BadRequestException("精确用量必须大于 0");
        }
      }
    }
  }

  private async buildAdminRecipeContent(tx: Prisma.TransactionClient, content: AdminRecipeContentInput): Promise<RecipeContentSnapshot> {
    const ingredientIds = Array.from(new Set(content.ingredients.map(item => item.ingredientId)));
    const unitIds = Array.from(new Set(content.ingredients.flatMap(item => (item.amount.kind === "EXACT" ? [item.amount.unitId] : []))));
    const [ingredientRows, unitRows] = await Promise.all([
      tx.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          ownerId: null,
          status: "ACTIVE",
          category: {
            is: {
              isSelectable: true
            }
          }
        }
      }),
      unitIds.length === 0
        ? []
        : tx.unit.findMany({
            where: {
              id: { in: unitIds },
              ownerId: null
            }
          })
    ]);
    if (ingredientRows.length !== ingredientIds.length) throw new NotFoundException("系统食材不存在或已下架");
    if (unitRows.length !== unitIds.length) throw new NotFoundException("系统单位不存在");

    const ingredientMap = new Map(ingredientRows.map(item => [item.id, item]));
    const unitMap = new Map(unitRows.map(item => [item.id, item]));

    return {
      name: content.name.trim(),
      story: content.story?.trim() || null,
      baseServings: content.baseServings,
      difficulty: content.difficulty,
      duration: content.duration,
      tips: content.tips?.trim() || null,
      ingredients: content.ingredients.map(item => {
        const ingredient = ingredientMap.get(item.ingredientId);
        if (!ingredient) throw new NotFoundException("系统食材不存在或已下架");
        if (item.amount.kind === "FUZZY") {
          return {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            source: "SYSTEM",
            categoryId: ingredient.categoryId,
            amount: {
              kind: "FUZZY",
              text: item.amount.text
            }
          };
        }
        const unit = unitMap.get(item.amount.unitId);
        if (!unit) throw new NotFoundException("系统单位不存在");
        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          source: "SYSTEM",
          categoryId: ingredient.categoryId,
          amount: {
            kind: "EXACT",
            quantity: item.amount.quantity.trim(),
            unitId: unit.id,
            unitName: unit.name,
            unitType: unit.type
          }
        };
      }),
      steps: content.steps.filter(item => item.text.trim()).map(item => ({ text: item.text.trim() }))
    };
  }

  private buildAdminRecipeVersionCreateInput(content: RecipeContentSnapshot): Prisma.RecipeContentVersionUncheckedCreateInput {
    return {
      createdByUserId: null,
      name: content.name,
      story: content.story,
      baseServings: content.baseServings,
      difficulty: content.difficulty,
      duration: content.duration,
      tips: content.tips,
      ingredientsJson: toJson(content.ingredients),
      stepsJson: toJson(content.steps),
      imagesJson: toJson([]),
      searchText: buildRecipeSearchText(content),
      contentSizeBytes: contentSizeBytes(content)
    };
  }

  private toUserRecipeSummary(recipe: AdminUserRecipeRow): MyRecipeSummary {
    const content = versionToContent(recipe.currentVersion);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      category: toRecipeCategorySummary(recipe.category!),
      version: recipe.version,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private toUserDraftSummary(draft: AdminDraftRow): RecipeDraftSummary {
    return {
      id: draft.id,
      recipeId: draft.recipeId,
      title: draft.title,
      category: draft.category ? toRecipeCategorySummary(draft.category) : null,
      version: draft.version,
      updatedAt: toIsoDate(draft.updatedAt)
    };
  }

  private toCollectedRecipeSummary(collection: AdminCollectionRow): CollectedRecipeSummary {
    const content = versionToContent(collection.sourceVersion);
    return {
      id: collection.id,
      sourceRecipeId: collection.sourceRecipeId,
      title: collection.sourceVersion.name,
      coverImageUrl: collection.sourceRecipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      category: toInspirationCategorySummary(collection.sourceRecipe.inspirationCategory!),
      scenes: collection.sceneLinks.map(link => toRecipeSceneSummary(link.scene)),
      contentVersionId: collection.sourceVersionId,
      collectedAt: toIsoDate(collection.createdAt),
      updatedAt: toIsoDate(collection.updatedAt)
    };
  }

  private async requireUser(tx: Prisma.TransactionClient, userId: UUID) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uid: true,
        nickname: true
      }
    });
    if (!user) throw new NotFoundException("用户不存在");
    return user;
  }

  private async requireUserExists(userId: UUID) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("用户不存在");
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

  private async requireIngredientCategory(tx: Prisma.TransactionClient, categoryId: UUID) {
    const category = await tx.ingredientCategory.findUnique({
      where: { id: categoryId }
    });
    if (!category) throw new NotFoundException("食材分类不存在");
    return category;
  }

  private async requireSelectableIngredientCategory(tx: Prisma.TransactionClient, categoryId: UUID) {
    const category = await this.requireIngredientCategory(tx, categoryId);
    if (!category.isSelectable) {
      throw new BadRequestException("该分类仅用于系统兜底，不能直接选择");
    }
    return category;
  }

  private async requireSystemUnit(tx: Prisma.TransactionClient, unitId: UUID) {
    const unit = await tx.unit.findFirst({
      where: {
        id: unitId,
        ownerId: null
      }
    });
    if (!unit) throw new NotFoundException("系统单位不存在");
    return unit;
  }

  private async assertSystemUnitNameAvailable(tx: Prisma.TransactionClient, searchKey: string, unitId: UUID | null) {
    const existing = await tx.unit.findFirst({
      where: {
        ownerId: null,
        searchKey,
        ...(unitId ? { NOT: { id: unitId } } : {})
      }
    });
    if (existing) throw new ConflictException("系统单位名称已存在");
  }

  private async requireSystemIngredient(tx: Prisma.TransactionClient, ingredientId: UUID, includeDisabled = false) {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: ingredientId,
        ownerId: null,
        status: includeDisabled
          ? {
              in: ["ACTIVE", "DISABLED"]
            }
          : "ACTIVE"
      },
      include: {
        category: true,
        defaultUnit: true
      }
    });
    if (!ingredient) throw new NotFoundException("系统食材不存在");
    return ingredient;
  }

  private async assertIngredientCategoryNameAvailable(tx: Prisma.TransactionClient, name: string, categoryId: UUID | null) {
    const existing = await tx.ingredientCategory.findFirst({
      where: {
        name,
        ...(categoryId ? { NOT: { id: categoryId } } : {})
      }
    });
    if (existing) throw new ConflictException("食材分类名称已存在");
  }

  private async assertSystemIngredientNameAvailable(tx: Prisma.TransactionClient, searchKey: string, ingredientId: UUID | null) {
    const existing = await tx.ingredient.findFirst({
      where: {
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED"]
        },
        searchKey,
        ...(ingredientId ? { NOT: { id: ingredientId } } : {})
      }
    });
    if (existing) throw new ConflictException("系统食材名称已存在");
  }

  private async requirePendingIngredientRecommendation(tx: Prisma.TransactionClient, ingredientId: UUID) {
    const recommendation = await tx.ingredientRecommendation.findFirst({
      where: {
        ingredientId,
        status: "PENDING"
      },
      include: {
        ingredient: {
          include: {
            owner: {
              select: {
                id: true,
                uid: true,
                nickname: true
              }
            },
            defaultUnit: true
          }
        }
      }
    });
    if (!recommendation || !recommendation.ingredient.ownerId || recommendation.ingredient.status !== "ACTIVE") {
      throw new NotFoundException("待审核个人食材不存在");
    }
    return recommendation;
  }

  private async nextIngredientCategorySortOrder(tx: Prisma.TransactionClient) {
    const last = await tx.ingredientCategory.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextSystemIngredientSortOrder(tx: Prisma.TransactionClient, categoryId: UUID) {
    const last = await tx.ingredient.findFirst({
      where: {
        ownerId: null,
        status: "ACTIVE",
        categoryId
      },
      orderBy: { systemSortOrder: "desc" },
      select: { systemSortOrder: true }
    });
    return (last?.systemSortOrder ?? -1) + 1;
  }

  private async nextSystemUnitSortOrder(tx: Prisma.TransactionClient, type: UnitSummary["type"]) {
    const last = await tx.unit.findFirst({
      where: {
        ownerId: null,
        type
      },
      orderBy: { systemSortOrder: "desc" },
      select: { systemSortOrder: true }
    });
    return (last?.systemSortOrder ?? -1) + 1;
  }

  private assertReorderScope<T extends { id: UUID; version: number }>(all: T[], items: ReorderItem[], label: string) {
    if (all.length !== items.length) throw new ConflictException(`${label}排序集合不完整`);
    const currentMap = new Map(all.map(item => [item.id, item.version]));
    for (const item of items) {
      const currentVersion = currentMap.get(item.id);
      if (!currentVersion) throw new ConflictException(`${label}排序集合包含无权对象`);
      if (currentVersion !== item.expectedVersion) throw new ConflictException(`${label}已被更新，请刷新后重试`);
    }
  }

  private async writeIngredientCategorySortOrder(tx: Prisma.TransactionClient, ids: UUID[]) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredientCategory.update({
        where: { id: ids[index] },
        data: { sortOrder: -(index + 1) * 1000 }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredientCategory.update({
        where: { id: ids[index] },
        data: {
          sortOrder: index,
          version: { increment: 1 }
        }
      });
    }
  }

  private async writeSystemIngredientSortOrder(tx: Prisma.TransactionClient, ids: UUID[], categoryId: UUID) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredient.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          status: "ACTIVE",
          categoryId
        },
        data: {
          systemSortOrder: -(index + 1) * 1000
        }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredient.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          status: "ACTIVE",
          categoryId
        },
        data: {
          systemSortOrder: index,
          version: { increment: 1 }
        }
      });
    }
  }

  private async writeSystemUnitSortOrder(tx: Prisma.TransactionClient, type: UnitSummary["type"], ids: UUID[]) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.unit.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          type
        },
        data: {
          systemSortOrder: -(index + 1) * 1000
        }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.unit.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          type
        },
        data: {
          systemSortOrder: index,
          version: {
            increment: 1
          }
        }
      });
    }
  }

  private async hasDraftUnitReference(tx: Prisma.TransactionClient, unitId: UUID) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_drafts" AS draft
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(draft."content_json"->'ingredients', '[]'::jsonb)) AS item
        WHERE item->'amount'->>'kind' = 'EXACT'
          AND item->'amount'->>'unitId' = ${unitId}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private async hasRecipeVersionUnitReference(tx: Prisma.TransactionClient, unitId: UUID) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      WITH "referenced_versions" AS (
        SELECT "current_version_id" AS "version_id" FROM "recipes"
        UNION
        SELECT "source_version_id" AS "version_id" FROM "recipe_collections"
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "meal_plan_items"
        UNION
        SELECT "bring_version_id" AS "version_id"
        FROM "dining_event_participants"
        WHERE "bring_version_id" IS NOT NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_content_versions" AS version
        INNER JOIN "referenced_versions" AS refs
          ON refs."version_id" = version."id"
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(version."ingredients_json", '[]'::jsonb)) AS item
        WHERE item->'amount'->>'kind' = 'EXACT'
          AND item->'amount'->>'unitId' = ${unitId}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private readNickname(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private buildUserPatch(body: UpdateAdminUserRequest) {
    const patch: {
      nickname?: string | null;
      phone?: string;
    } = {};
    if (body.nickname !== undefined) {
      patch.nickname = this.readNickname(body.nickname);
    }
    if (body.phone !== undefined) {
      patch.phone = body.phone.trim();
    }
    return patch;
  }

  private async createUserRecord(
    tx: Prisma.TransactionClient,
    input: {
      phone: string;
      password: string;
      nickname: string | null;
      status: "ACTIVE" | "DISABLED";
    }
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await tx.user.create({
          data: {
            uid: this.createUid(),
            phone: input.phone,
            nickname: input.nickname,
            passwordHash: hashPassword(input.password),
            status: input.status
          },
          select: {
            id: true,
            uid: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("phone")) {
          throw new ConflictException("手机号已存在");
        }
        if (!targets.includes("uid")) {
          throw error;
        }
      }
    }

    throw new BadRequestException("创建用户失败，请稍后重试");
  }

  private async updateUserRecord(
    tx: Prisma.TransactionClient,
    userId: UUID,
    patch: { nickname?: string | null; phone?: string }
  ) {
    try {
      return await tx.user.update({
        where: { id: userId },
        data: patch,
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("phone")) {
          throw new ConflictException("手机号已存在");
        }
      }
      throw error;
    }
  }

  private createUid() {
    return randomInt(10_000_000, 100_000_000);
  }

  private hashSecret(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
