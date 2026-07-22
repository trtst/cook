import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AcceptInviteResponse,
  CarryBackSnapshotSummary,
  CreateInviteResult,
  CurrentSpaceSummary,
  DiningGroupMemberSummary,
  DiningGroupMembersResult,
  GetCarryBackSnapshotsResponse,
  GetCurrentDiningGroupContextResponse,
  LeaveDiningGroupResponse,
  OriginalSpaceSummary,
  UUID
} from "../../contracts/types";
import { Prisma, type CarryBackSnapshot, type DiningGroup, type DiningGroupMember, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import { EntitlementService } from "../entitlement/entitlement.service";

const inviteTokenBytes = 32;
const createInviteOperation = "dining-group-invite:create";
const acceptInviteOperation = "dining-group-invite:accept";
const leaveDiningGroupOperation = "dining-group:leave";
const invalidInviteMessage = "邀请已失效";

type MemberWithUser = DiningGroupMember & {
  user: Pick<User, "id" | "uid" | "nickname" | "avatarUrl">;
};

function toIsoDate(value: Date) {
  return value.toISOString();
}

function createOpaqueInviteToken() {
  return randomBytes(inviteTokenBytes).toString("base64url");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function fromJson<T>(value: unknown): T {
  return value as T;
}

@Injectable()
export class DiningGroupService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  getCurrent(userId: UUID) {
    return this.prisma.$transaction(tx => this.getCurrentWith(tx, userId));
  }

  async listSnapshots(userId: UUID): Promise<GetCarryBackSnapshotsResponse> {
    const snapshots = await this.prisma.carryBackSnapshot.findMany({
      where: { userId, status: "AVAILABLE", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    });

    return { snapshots: snapshots.map(snapshot => this.toSnapshotSummary(snapshot)) };
  }

  async listMembers(userId: UUID, diningGroupId: UUID): Promise<DiningGroupMembersResult> {
    await this.requireCurrentMember(userId, diningGroupId);

    const members = await this.prisma.diningGroupMember.findMany({
      where: {
        diningGroupId,
        status: { in: ["ACTIVE", "RESTRICTED"] }
      },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    return {
      diningGroupId,
      members: members.map(member => this.toMemberSummary(member))
    };
  }

  async createInvite(userId: UUID, diningGroupId: UUID, operationId: UUID): Promise<CreateInviteResult> {
    const membership = await this.requireCurrentMember(userId, diningGroupId);

    if (membership.role === "MEMBER") {
      throw new ForbiddenException("无权邀请成员");
    }

    const requestHash = hashText(diningGroupId);
    const repeated = await this.getIdempotentResult<CreateInviteResult>(
      operationId,
      createInviteOperation,
      userId,
      diningGroupId,
      requestHash
    );
    if (repeated) return repeated;

    const [activeMemberCount, memberLimit] = await Promise.all([
      this.prisma.diningGroupMember.count({ where: { diningGroupId, status: "ACTIVE" } }),
      this.entitlementService.getMemberLimit(this.prisma, diningGroupId)
    ]);
    if (activeMemberCount >= memberLimit) throw new BadRequestException("饭搭子成员已达上限");

    const expiresAt = new Date(Date.now() + policy.inviteExpiresMs);
    const inviteToken = createOpaqueInviteToken();
    const result = {
      inviteToken,
      sharePath: `/pages_restaurant/invite/index?token=${encodeURIComponent(inviteToken)}`,
      expiresAt: expiresAt.toISOString()
    };

    try {
      await this.prisma.$transaction(async tx => {
        await tx.diningGroupInvite.create({
          data: {
            diningGroupId,
            createdByUserId: userId,
            tokenHash: hashText(inviteToken),
            status: "PENDING",
            expiresAt,
            policyVersion: policy.version
          }
        });

        await this.saveIdempotentResult(
          tx,
          operationId,
          createInviteOperation,
          userId,
          diningGroupId,
          requestHash,
          result
        );
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const existing = await this.getIdempotentResult<CreateInviteResult>(
          operationId,
          createInviteOperation,
          userId,
          diningGroupId,
          requestHash
        );
        if (existing) return existing;
      }
      throw error;
    }

    return result;
  }

  async acceptInvite(userId: UUID, inviteToken: string, operationId: UUID): Promise<AcceptInviteResponse> {
    const tokenHash = hashText(inviteToken);
    const invite = await this.prisma.diningGroupInvite.findUnique({
      where: { tokenHash },
      select: { diningGroupId: true }
    });
    if (!invite) throw new BadRequestException(invalidInviteMessage);

    const repeated = await this.getIdempotentResult<AcceptInviteResponse>(
      operationId,
      acceptInviteOperation,
      userId,
      invite.diningGroupId,
      tokenHash
    );
    if (repeated) return repeated;

    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "dining_group_invites" WHERE "token_hash" = ${tokenHash} FOR UPDATE`;

        const currentInvite = await tx.diningGroupInvite.findUnique({ where: { tokenHash } });
        if (!currentInvite || currentInvite.status !== "PENDING" || currentInvite.expiresAt <= new Date()) {
          throw new BadRequestException(invalidInviteMessage);
        }

        await tx.$queryRaw`SELECT "user_id" FROM "user_spaces" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${currentInvite.diningGroupId}::uuid FOR UPDATE`;

        const userSpace = await tx.userSpace.findUnique({
          where: { userId },
          include: { originalDiningGroup: true }
        });
        if (!userSpace) throw new BadRequestException("当前账号尚未初始化单人空间");
        if (userSpace.currentDiningGroupId !== userSpace.originalDiningGroupId) {
          throw new BadRequestException("当前已加入长期饭搭子，请先退出后再加入");
        }
        if (currentInvite.diningGroupId === userSpace.originalDiningGroupId) {
          throw new BadRequestException("不能加入自己的饭搭子");
        }

        const originalMemberCount = await tx.diningGroupMember.count({
          where: {
            diningGroupId: userSpace.originalDiningGroupId,
            status: { in: ["ACTIVE", "RESTRICTED"] }
          }
        });
        if (originalMemberCount !== 1) {
          throw new BadRequestException("已有长期成员的主理人不能加入其他饭搭子");
        }

        const targetGroup = await tx.diningGroup.findUnique({ where: { id: currentInvite.diningGroupId } });
        if (!targetGroup || targetGroup.status !== "ACTIVE") throw new NotFoundException("饭搭子不存在");

        const [activeMemberCount, existingMember, memberLimit] = await Promise.all([
          tx.diningGroupMember.count({ where: { diningGroupId: targetGroup.id, status: "ACTIVE" } }),
          tx.diningGroupMember.findUnique({
            where: { diningGroupId_userId: { diningGroupId: targetGroup.id, userId } }
          }),
          this.entitlementService.getMemberLimit(tx, targetGroup.id)
        ]);
        if (existingMember?.status !== "ACTIVE" && activeMemberCount >= memberLimit) {
          throw new BadRequestException("饭搭子成员已达上限");
        }

        await tx.carryBackSnapshot.updateMany({
          where: { userId, sourceDiningGroupId: targetGroup.id, status: "AVAILABLE" },
          data: { status: "INVALIDATED", invalidatedAt: new Date() }
        });
        await tx.diningGroup.update({
          where: { id: userSpace.originalDiningGroupId },
          data: { status: "FROZEN", frozenAt: new Date(), version: { increment: 1 } }
        });

        if (existingMember) {
          await tx.diningGroupMember.update({
            where: { id: existingMember.id },
            data: {
              role: existingMember.role === "OWNER" ? "OWNER" : "MEMBER",
              status: "ACTIVE",
              statusReason: null,
              restrictedAt: null,
              endedAt: null,
              joinedAt: new Date(),
              version: { increment: 1 }
            }
          });
        } else {
          await tx.diningGroupMember.create({
            data: { diningGroupId: targetGroup.id, userId, role: "MEMBER", status: "ACTIVE" }
          });
        }

        await tx.userSpace.update({
          where: { userId },
          data: { currentDiningGroupId: targetGroup.id, version: { increment: 1 } }
        });
        await tx.diningGroupInvite.update({
          where: { id: currentInvite.id },
          data: { status: "ACCEPTED", acceptedByUserId: userId, acceptedAt: new Date() }
        });
        await this.writeLifecycleEvent(tx, userId, targetGroup.id, "DINING_GROUP_INVITE_ACCEPTED", userSpace.originalDiningGroupId);

        const context = await this.getCurrentWith(tx, userId);
        if (!context.originalSpace) throw new BadRequestException("原空间冻结失败");
        const result: AcceptInviteResponse = {
          currentSpace: context.currentSpace,
          originalSpace: context.originalSpace,
          pendingImportCounts: context.originalSpace.pendingImportCounts
        };

        await this.saveIdempotentResult(
          tx,
          operationId,
          acceptInviteOperation,
          userId,
          targetGroup.id,
          tokenHash,
          result
        );
        return result;
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const existing = await this.getIdempotentResult<AcceptInviteResponse>(
          operationId,
          acceptInviteOperation,
          userId,
          invite.diningGroupId,
          tokenHash
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  async leave(userId: UUID, diningGroupId: UUID, operationId: UUID): Promise<LeaveDiningGroupResponse> {
    const requestHash = hashText(diningGroupId);
    const repeated = await this.getIdempotentResult<LeaveDiningGroupResponse>(
      operationId,
      leaveDiningGroupOperation,
      userId,
      diningGroupId,
      requestHash
    );
    if (repeated) return repeated;

    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "user_id" FROM "user_spaces" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${diningGroupId}::uuid FOR UPDATE`;

        const userSpace = await tx.userSpace.findUnique({
          where: { userId },
          include: { originalDiningGroup: true, currentDiningGroup: true }
        });
        if (!userSpace || userSpace.currentDiningGroupId !== diningGroupId) {
          throw new NotFoundException("饭搭子不存在");
        }
        if (userSpace.originalDiningGroupId === diningGroupId) {
          throw new BadRequestException("主理人不能直接退出自己的饭搭子");
        }

        const member = await tx.diningGroupMember.findUnique({
          where: { diningGroupId_userId: { diningGroupId, userId } }
        });
        if (!member || member.status === "ENDED") throw new NotFoundException("饭搭子不存在");
        if (member.role === "OWNER") throw new BadRequestException("主理人不能直接退出自己的饭搭子");

        const memberCount = await tx.diningGroupMember.count({
          where: { diningGroupId, status: "ACTIVE" }
        });
        const entitlements = await this.entitlementService.resolve(tx, {
          userId,
          diningGroupId,
          ownerId: userSpace.currentDiningGroup.ownerId,
          memberCount
        });

        await tx.diningGroupMember.update({
          where: { id: member.id },
          data: {
            status: "ENDED",
            statusReason: "LEFT",
            restrictedAt: null,
            endedAt: new Date(),
            version: { increment: 1 }
          }
        });
        await tx.diningGroup.update({
          where: { id: userSpace.originalDiningGroupId },
          data: { status: "ACTIVE", frozenAt: null, archivedAt: null, version: { increment: 1 } }
        });
        await tx.userSpace.update({
          where: { userId },
          data: { currentDiningGroupId: userSpace.originalDiningGroupId, version: { increment: 1 } }
        });

        const snapshot = await tx.carryBackSnapshot.create({
          data: {
            userId,
            sourceDiningGroupId: diningGroupId,
            targetDiningGroupId: userSpace.originalDiningGroupId,
            sourceDiningGroupName: userSpace.currentDiningGroup.name,
            expiresAt: new Date(Date.now() + entitlements.snapshotDays * 24 * 60 * 60 * 1000),
            policyVersion: policy.version
          }
        });
        await this.writeLifecycleEvent(tx, userId, diningGroupId, "DINING_GROUP_LEFT", userSpace.originalDiningGroupId);

        const context = await this.getCurrentWith(tx, userId);
        const result: LeaveDiningGroupResponse = {
          restoredSpace: context.currentSpace,
          carryBackSnapshot: this.toSnapshotSummary(snapshot),
          futureParticipationCount: 0
        };

        await this.saveIdempotentResult(
          tx,
          operationId,
          leaveDiningGroupOperation,
          userId,
          diningGroupId,
          requestHash,
          result
        );
        return result;
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const existing = await this.getIdempotentResult<LeaveDiningGroupResponse>(
          operationId,
          leaveDiningGroupOperation,
          userId,
          diningGroupId,
          requestHash
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async requireCurrentMember(userId: UUID, diningGroupId: UUID) {
    const userSpace = await this.prisma.userSpace.findUnique({ where: { userId } });
    if (!userSpace || userSpace.currentDiningGroupId !== diningGroupId) throw new NotFoundException("饭搭子不存在");

    const member = await this.prisma.diningGroupMember.findUnique({
      where: { diningGroupId_userId: { diningGroupId, userId } }
    });
    if (!member || member.status !== "ACTIVE") throw new ForbiddenException("当前成员无权访问完整饭搭子数据");
    return member;
  }

  private async getCurrentWith(tx: Prisma.TransactionClient, userId: UUID): Promise<GetCurrentDiningGroupContextResponse> {
    const userSpace = await tx.userSpace.findUnique({
      where: { userId },
      include: { currentDiningGroup: true, originalDiningGroup: true }
    });
    if (!userSpace) throw new BadRequestException("当前账号尚未初始化单人空间");

    const member = await tx.diningGroupMember.findUnique({
      where: { diningGroupId_userId: { diningGroupId: userSpace.currentDiningGroupId, userId } }
    });
    if (!member || member.status === "ENDED") throw new BadRequestException("当前空间成员关系无效");

    const memberCount = await tx.diningGroupMember.count({
      where: { diningGroupId: userSpace.currentDiningGroupId, status: "ACTIVE" }
    });
    const snapshots = await tx.carryBackSnapshot.findMany({
      where: { userId, status: "AVAILABLE", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    });
    const entitlements = await this.entitlementService.resolve(tx, {
      userId,
      diningGroupId: userSpace.currentDiningGroupId,
      ownerId: userSpace.currentDiningGroup.ownerId,
      memberCount
    });
    const memberLimit = policy.memberLimit[entitlements.diningGroupTier];

    return {
      currentSpace: this.toCurrentSpace(userSpace.currentDiningGroup, member, memberCount, memberLimit),
      originalSpace:
        userSpace.originalDiningGroupId === userSpace.currentDiningGroupId
          ? null
          : this.toOriginalSpace(userSpace.originalDiningGroup),
      carryBackSnapshots: snapshots.map(snapshot => this.toSnapshotSummary(snapshot)),
      entitlements,
      storage: {
        state: "NORMAL",
        usedBytes: 0,
        limitBytes: entitlements.storageLimitBytes,
        remainingBytes: entitlements.storageLimitBytes,
        byModule: []
      }
    };
  }

  private toCurrentSpace(
    diningGroup: DiningGroup,
    member: DiningGroupMember,
    memberCount: number,
    memberLimit: number
  ): CurrentSpaceSummary {
    return {
      id: diningGroup.id,
      name: diningGroup.name,
      ownerId: diningGroup.ownerId,
      myRole: member.role,
      myStatus: member.status,
      myStatusReason: member.statusReason,
      memberCount,
      memberLimit,
      state: "NORMAL",
      version: diningGroup.version,
      createdAt: toIsoDate(diningGroup.createdAt),
      updatedAt: toIsoDate(diningGroup.updatedAt)
    };
  }

  private toOriginalSpace(diningGroup: DiningGroup): OriginalSpaceSummary {
    return {
      id: diningGroup.id,
      name: diningGroup.name,
      status: diningGroup.status === "FROZEN" ? "FROZEN" : "ACTIVE",
      frozenAt: diningGroup.frozenAt ? toIsoDate(diningGroup.frozenAt) : null,
      canImport: diningGroup.status === "FROZEN",
      pendingImportCounts: { recipe: 0, fridgeItem: 0, planDraft: 0, shoppingItem: 0 }
    };
  }

  private toSnapshotSummary(snapshot: CarryBackSnapshot): CarryBackSnapshotSummary {
    return {
      id: snapshot.id,
      sourceDiningGroupId: snapshot.sourceDiningGroupId,
      sourceDiningGroupName: snapshot.sourceDiningGroupName,
      status: snapshot.expiresAt <= new Date() && snapshot.status === "AVAILABLE" ? "EXPIRED" : snapshot.status,
      expiresAt: toIsoDate(snapshot.expiresAt),
      createdAt: toIsoDate(snapshot.createdAt),
      itemCounts: {
        recipe: snapshot.recipeCount,
        fridgeItem: snapshot.fridgeItemCount,
        shoppingItem: snapshot.shoppingItemCount
      }
    };
  }

  private toMemberSummary(member: MemberWithUser): DiningGroupMemberSummary {
    return {
      id: member.id,
      diningGroupId: member.diningGroupId,
      user: {
        id: member.user.id,
        uid: member.user.uid,
        nickname: member.user.nickname,
        avatarUrl: member.user.avatarUrl
      },
      role: member.role,
      status: member.status,
      statusReason: member.statusReason,
      joinedAt: toIsoDate(member.joinedAt),
      restrictedAt: member.restrictedAt ? toIsoDate(member.restrictedAt) : null,
      endedAt: member.endedAt ? toIsoDate(member.endedAt) : null,
      version: member.version
    };
  }

  private async getIdempotentResult<T>(
    operationId: UUID,
    operationType: string,
    userId: UUID,
    diningGroupId: UUID | null,
    requestHash: string
  ): Promise<T | null> {
    const record = await this.prisma.idempotencyRecord.findFirst({
      where: { operationId, operationType, userId, diningGroupId },
      orderBy: { createdAt: "asc" }
    });
    if (!record) return null;
    if (record.requestHash !== requestHash) throw new BadRequestException("operationId 已用于其他请求");
    return record.status === "SUCCEEDED" && record.resultJson ? fromJson<T>(record.resultJson) : null;
  }

  private saveIdempotentResult<T>(
    tx: Prisma.TransactionClient,
    operationId: UUID,
    operationType: string,
    userId: UUID,
    diningGroupId: UUID | null,
    requestHash: string,
    result: T
  ) {
    return tx.idempotencyRecord.create({
      data: {
        operationId,
        operationType,
        userId,
        diningGroupId,
        requestHash,
        status: "SUCCEEDED",
        resultJson: toJson(result)
      }
    });
  }

  private async writeLifecycleEvent(
    tx: Prisma.TransactionClient,
    userId: UUID,
    diningGroupId: UUID,
    action: string,
    originalDiningGroupId: UUID
  ) {
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorUserId: userId,
        action,
        objectType: "DINING_GROUP",
        objectId: diningGroupId,
        diningGroupId,
        payload: { originalDiningGroupId }
      }
    });
    await tx.outboxEvent.create({
      data: {
        eventType: action,
        aggregateType: "DINING_GROUP",
        aggregateId: diningGroupId,
        payload: { userId, originalDiningGroupId }
      }
    });
  }

  private isUniqueError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
