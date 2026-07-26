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
  AdminResetUserPasswordResponse,
  AdminDiningGroupSummary,
  AdminRecipeSummary,
  CreateAdminUserRequest,
  AdminLoginRequest,
  AdminUserEntitlementResponse,
  PageResult,
  RecipeReportSummary,
  ResetAdminUserPasswordRequest,
  RelationshipState,
  SetAdminUserStatusRequest,
  StorageUsageSummary,
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

function toUserProfile(user: {
  id: string;
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

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AdminTokenService)
    private readonly adminTokenService: AdminTokenService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService
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

  async listUsers(page: number, pageSize: number, keyword?: string): Promise<PageResult<UserProfile>> {
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
    status?: string
  ): Promise<PageResult<AdminDiningGroupSummary>> {
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

  async listRecipes(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string,
    reportsOnly?: boolean
  ): Promise<PageResult<AdminRecipeSummary>> {
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
      ...(normalizedStatus ? { status: normalizedStatus as RecipeStatus } : {}),
      ...(reportsOnly ? { reportCount: { gt: 0 } } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: {
            select: { uid: true }
          }
        },
        orderBy: [{ reportCount: "desc" }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        coverImageUrl: recipe.coverImageUrl,
        status: recipe.status,
        updatedAt: toIsoDate(recipe.updatedAt),
        ownerUid: recipe.owner?.uid ?? null,
        reportCount: recipe.reportCount,
        blockedReason: recipe.blockedReason
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listRecipeReports(page: number, pageSize: number, status?: string): Promise<PageResult<RecipeReportSummary>> {
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

  async blockRecipe(recipeId: UUID, adminId: UUID, operationId: UUID, reason: string) {
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
      const result = {
        id: recipe.id,
        title: recipe.title,
        coverImageUrl: recipe.coverImageUrl,
        status: recipe.status,
        updatedAt: toIsoDate(recipe.updatedAt),
        ownerUid: recipe.owner?.uid ?? null,
        reportCount: recipe.reportCount,
        blockedReason: recipe.blockedReason
      } satisfies AdminRecipeSummary;
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

  async unblockRecipe(recipeId: UUID, adminId: UUID, operationId: UUID) {
    await this.requireSuperAdmin(adminId);
    const requestHash = recipeId;
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
      const result = {
        id: recipe.id,
        title: recipe.title,
        coverImageUrl: recipe.coverImageUrl,
        status: recipe.status,
        updatedAt: toIsoDate(recipe.updatedAt),
        ownerUid: recipe.owner?.uid ?? null,
        reportCount: recipe.reportCount,
        blockedReason: recipe.blockedReason
      } satisfies AdminRecipeSummary;
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

  async resolveRecipeReport(reportId: UUID, adminId: UUID, operationId: UUID, resolutionNote?: string | null) {
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

  private async requireSuperAdmin(adminId: UUID) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: { status: true, roles: true }
    });
    if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("无权执行该操作");
    }
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
