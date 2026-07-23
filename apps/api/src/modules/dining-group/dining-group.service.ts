import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type DiningGroup, type DiningGroupMember, type LongTermMemberStatus, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import type {
  AcceptInviteResponse,
  CreateInviteResult,
  DiningGroupUsageSummary,
  DiningGroupMemberSummary,
  DiningGroupMembersResult,
  DiningGroupSummary,
  DissolveDiningGroupResponse,
  GetMyDiningGroupsResponse,
  LeaveDiningGroupResponse,
  RemoveDiningGroupMemberResponse,
  StorageUsageSummary,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";

const inviteTokenBytes = 32;
const createInviteOperation = "dining-group-invite:create";
const acceptInviteOperation = "dining-group-invite:accept";
const leaveDiningGroupOperation = "dining-group:leave";
const removeMemberOperation = "dining-group:remove-member";
const dissolveDiningGroupOperation = "dining-group:dissolve";
const invalidInviteMessage = "邀请已失效";
const activeStatuses: LongTermMemberStatus[] = ["ACTIVE", "RESTRICTED"];

type MemberWithUser = DiningGroupMember & {
  user: Pick<User, "uid" | "nickname" | "avatarUrl">;
};

type DiningGroupWithOwnerUid = DiningGroup & {
  owner: Pick<User, "uid">;
};

function toIsoDate(value: Date) {
  return value.toISOString();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createOpaqueInviteToken() {
  return randomBytes(inviteTokenBytes).toString("base64url");
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

  async listMine(userId: UUID): Promise<GetMyDiningGroupsResponse> {
    return this.prisma.$transaction(async tx => {
      const [memberships, resolved] = await Promise.all([
        tx.diningGroupMember.findMany({
          where: {
            userId,
            status: { in: activeStatuses },
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
        this.entitlementService.resolveForUser(tx, userId)
      ]);

      const items = await Promise.all(memberships.map(membership => this.buildDiningGroupSummary(tx, membership.diningGroupId, membership)));
      const usage: DiningGroupUsageSummary = {
        ownedCount: resolved.ownedDiningGroupCount,
        joinedCount: resolved.joinedDiningGroupCount,
        joinLimit: resolved.joinLimit,
        state: resolved.state
      };

      return { items, usage };
    });
  }

  async listMembers(userId: UUID, diningGroupId: UUID): Promise<DiningGroupMembersResult> {
    await this.requireActiveMembership(this.prisma, userId, diningGroupId);

    const members = await this.prisma.diningGroupMember.findMany({
      where: {
        diningGroupId,
        status: { in: activeStatuses }
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
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

  async getStorageUsage(userId: UUID): Promise<StorageUsageSummary> {
    return this.prisma.$transaction(async tx => {
      const [resolved, rows] = await Promise.all([
        this.entitlementService.resolveForUser(tx, userId),
        tx.storageLedger.findMany({
          where: { userId },
          select: {
            module: true,
            usedBytes: true
          }
        })
      ]);
      const byModuleMap = new Map<string, number>();
      for (const row of rows) {
        byModuleMap.set(row.module, (byModuleMap.get(row.module) ?? 0) + row.usedBytes);
      }
      const usedBytes = Array.from(byModuleMap.values()).reduce((total, value) => total + value, 0);
      const remainingBytes = Math.max(0, resolved.storageLimitBytes - usedBytes);
      return {
        state: usedBytes > resolved.storageLimitBytes ? "OVER_STORAGE_READONLY" : "NORMAL",
        usedBytes,
        limitBytes: resolved.storageLimitBytes,
        remainingBytes,
        byModule: Array.from(byModuleMap.entries()).map(([module, moduleUsedBytes]) => ({
          module: module as StorageUsageSummary["byModule"][number]["module"],
          usedBytes: moduleUsedBytes
        })),
        calculatedAt: toIsoDate(new Date())
      };
    });
  }

  async createInvite(userId: UUID, diningGroupId: UUID, operationId: UUID): Promise<CreateInviteResult> {
    const requestHash = hashText(diningGroupId);
    const repeated = await this.getIdempotentResult<CreateInviteResult>(
      operationId,
      createInviteOperation,
      userId,
      diningGroupId,
      requestHash
    );
    if (repeated) return repeated;

    const inviteToken = createOpaqueInviteToken();
    const expiresAt = new Date(Date.now() + policy.inviteExpiresMs);
    const result = {
      inviteToken,
      sharePath: `/pages_restaurant/invite/index?token=${encodeURIComponent(inviteToken)}`,
      expiresAt: toIsoDate(expiresAt)
    };

    try {
      await this.prisma.$transaction(async tx => {
        await this.startIdempotentOperation(tx, operationId, createInviteOperation, userId, diningGroupId, requestHash);
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${diningGroupId}::uuid FOR UPDATE`;

        const ownerMembership = await this.requireOwnerMembership(tx, userId, diningGroupId);
        const entitlements = await this.entitlementService.resolveForUser(tx, userId);
        if (entitlements.state === "OVER_MEMBER_LIMIT") {
          throw new ForbiddenException("当前已超出饭搭子关系上限");
        }

        const activeMemberCount = await tx.diningGroupMember.count({
          where: { diningGroupId, status: { in: activeStatuses } }
        });
        if (activeMemberCount >= entitlements.memberLimit) {
          throw new BadRequestException("饭搭子成员已达上限");
        }

        await tx.diningGroupInvite.create({
          data: {
            diningGroupId,
            createdByUserId: ownerMembership.userId,
            tokenHash: hashText(inviteToken),
            status: "PENDING",
            expiresAt,
            policyVersion: policy.version
          }
        });

        await this.writeLifecycleEvent(tx, userId, diningGroupId, "DINING_GROUP_INVITE_CREATED", {
          diningGroupId
        });
        await this.completeIdempotentOperation(
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
        await this.startIdempotentOperation(
          tx,
          operationId,
          acceptInviteOperation,
          userId,
          invite.diningGroupId,
          tokenHash
        );

        await tx.$queryRaw`SELECT "id" FROM "dining_group_invites" WHERE "token_hash" = ${tokenHash} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${invite.diningGroupId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;

        const currentInvite = await tx.diningGroupInvite.findUnique({
          where: { tokenHash },
          include: {
            diningGroup: {
              include: { owner: { select: { uid: true } } }
            }
          }
        });
        if (!currentInvite || currentInvite.status !== "PENDING" || currentInvite.expiresAt <= new Date()) {
          throw new BadRequestException(invalidInviteMessage);
        }
        if (currentInvite.diningGroup.status !== "ACTIVE") {
          throw new NotFoundException("饭搭子不存在");
        }

        const existingMember = await tx.diningGroupMember.findUnique({
          where: {
            diningGroupId_userId: {
              diningGroupId: currentInvite.diningGroupId,
              userId
            }
          }
        });
        if (existingMember?.status === "ACTIVE" || existingMember?.status === "RESTRICTED") {
          throw new BadRequestException("当前已加入该饭搭子");
        }

        const userEntitlements = await this.entitlementService.resolveForUser(tx, userId);
        if (userEntitlements.joinedDiningGroupCount >= userEntitlements.joinLimit) {
          throw new BadRequestException("可加入饭搭子数已达上限");
        }

        const ownerEntitlements = await this.entitlementService.resolveForUser(tx, currentInvite.diningGroup.ownerId);
        const activeMemberCount = await tx.diningGroupMember.count({
          where: { diningGroupId: currentInvite.diningGroupId, status: { in: activeStatuses } }
        });
        if (activeMemberCount >= ownerEntitlements.memberLimit) {
          throw new BadRequestException("饭搭子成员已达上限");
        }

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
            data: {
              diningGroupId: currentInvite.diningGroupId,
              userId,
              role: "MEMBER",
              status: "ACTIVE"
            }
          });
        }

        await tx.diningGroupInvite.update({
          where: { id: currentInvite.id },
          data: { status: "ACCEPTED", acceptedByUserId: userId, acceptedAt: new Date() }
        });
        await tx.diningGroup.update({
          where: { id: currentInvite.diningGroupId },
          data: { version: { increment: 1 } }
        });

        const membership = await this.requireActiveMembership(tx, userId, currentInvite.diningGroupId);
        const diningGroup = await this.buildDiningGroupSummary(tx, currentInvite.diningGroupId, membership);
        const result: AcceptInviteResponse = { diningGroup };

        await this.writeLifecycleEvent(tx, userId, currentInvite.diningGroupId, "DINING_GROUP_INVITE_ACCEPTED", {
          diningGroupId: currentInvite.diningGroupId
        });
        await this.completeIdempotentOperation(
          tx,
          operationId,
          acceptInviteOperation,
          userId,
          currentInvite.diningGroupId,
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

  async leave(
    userId: UUID,
    diningGroupId: UUID,
    operationId: UUID,
    expectedVersion: number
  ): Promise<LeaveDiningGroupResponse> {
    const requestHash = hashText(`${diningGroupId}:${expectedVersion}`);
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
        await this.startIdempotentOperation(tx, operationId, leaveDiningGroupOperation, userId, diningGroupId, requestHash);
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${diningGroupId}::uuid FOR UPDATE`;

        const member = await this.requireActiveMembership(tx, userId, diningGroupId);
        if (member.role === "OWNER") {
          throw new BadRequestException("主理人请直接解散饭搭子");
        }
        await this.assertGroupVersion(tx, diningGroupId, expectedVersion);

        const leftAt = new Date();
        await tx.diningGroupMember.update({
          where: { id: member.id },
          data: {
            status: "ENDED",
            statusReason: "LEFT",
            restrictedAt: null,
            endedAt: leftAt,
            version: { increment: 1 }
          }
        });
        await tx.diningGroup.update({
          where: { id: diningGroupId },
          data: { version: { increment: 1 } }
        });

        const result: LeaveDiningGroupResponse = {
          diningGroupId,
          leftAt: toIsoDate(leftAt)
        };

        await this.writeLifecycleEvent(tx, userId, diningGroupId, "DINING_GROUP_LEFT", {
          diningGroupId
        });
        await this.completeIdempotentOperation(
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

  async removeMember(
    userId: UUID,
    diningGroupId: UUID,
    targetUserId: UUID,
    operationId: UUID,
    expectedVersion: number
  ): Promise<RemoveDiningGroupMemberResponse> {
    const requestHash = hashText(`${diningGroupId}:${targetUserId}:${expectedVersion}`);
    const repeated = await this.getIdempotentResult<RemoveDiningGroupMemberResponse>(
      operationId,
      removeMemberOperation,
      userId,
      diningGroupId,
      requestHash
    );
    if (repeated) return repeated;

    try {
      return await this.prisma.$transaction(async tx => {
        await this.startIdempotentOperation(tx, operationId, removeMemberOperation, userId, diningGroupId, requestHash);
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${diningGroupId}::uuid FOR UPDATE`;

        await this.requireOwnerMembership(tx, userId, diningGroupId);
        const member = await this.requireActiveMembership(tx, targetUserId, diningGroupId);
        if (member.role === "OWNER") throw new BadRequestException("不能移除主理人");
        await this.assertGroupVersion(tx, diningGroupId, expectedVersion);

        const removedAt = new Date();
        await tx.diningGroupMember.update({
          where: { id: member.id },
          data: {
            status: "ENDED",
            statusReason: "REMOVED",
            restrictedAt: null,
            endedAt: removedAt,
            version: { increment: 1 }
          }
        });
        await tx.diningGroup.update({
          where: { id: diningGroupId },
          data: { version: { increment: 1 } }
        });

        const result: RemoveDiningGroupMemberResponse = {
          diningGroupId,
          userId: targetUserId,
          removedAt: toIsoDate(removedAt)
        };

        await this.writeLifecycleEvent(tx, userId, diningGroupId, "DINING_GROUP_MEMBER_REMOVED", {
          diningGroupId,
          targetUserId
        });
        await this.completeIdempotentOperation(
          tx,
          operationId,
          removeMemberOperation,
          userId,
          diningGroupId,
          requestHash,
          result
        );
        return result;
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const existing = await this.getIdempotentResult<RemoveDiningGroupMemberResponse>(
          operationId,
          removeMemberOperation,
          userId,
          diningGroupId,
          requestHash
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  async dissolve(
    userId: UUID,
    diningGroupId: UUID,
    operationId: UUID,
    expectedVersion: number
  ): Promise<DissolveDiningGroupResponse> {
    const requestHash = hashText(`${diningGroupId}:${expectedVersion}`);
    const repeated = await this.getIdempotentResult<DissolveDiningGroupResponse>(
      operationId,
      dissolveDiningGroupOperation,
      userId,
      diningGroupId,
      requestHash
    );
    if (repeated) return repeated;

    try {
      return await this.prisma.$transaction(async tx => {
        await this.startIdempotentOperation(
          tx,
          operationId,
          dissolveDiningGroupOperation,
          userId,
          diningGroupId,
          requestHash
        );
        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${diningGroupId}::uuid FOR UPDATE`;
        await this.requireOwnerMembership(tx, userId, diningGroupId);
        await this.assertGroupVersion(tx, diningGroupId, expectedVersion);

        const dissolvedAt = new Date();
        await tx.diningGroupMember.updateMany({
          where: {
            diningGroupId,
            status: { in: activeStatuses }
          },
          data: {
            status: "ENDED",
            statusReason: "GROUP_DISSOLVED",
            restrictedAt: null,
            endedAt: dissolvedAt
          }
        });
        await tx.diningGroupInvite.updateMany({
          where: {
            diningGroupId,
            status: "PENDING"
          },
          data: {
            status: "REVOKED",
            revokedAt: dissolvedAt
          }
        });
        await tx.diningGroup.update({
          where: { id: diningGroupId },
          data: {
            status: "ARCHIVED",
            archivedAt: dissolvedAt,
            version: { increment: 1 }
          }
        });

        const result: DissolveDiningGroupResponse = {
          diningGroupId,
          dissolvedAt: toIsoDate(dissolvedAt)
        };

        await this.writeLifecycleEvent(tx, userId, diningGroupId, "DINING_GROUP_DISSOLVED", {
          diningGroupId
        });
        await this.completeIdempotentOperation(
          tx,
          operationId,
          dissolveDiningGroupOperation,
          userId,
          diningGroupId,
          requestHash,
          result
        );
        return result;
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const existing = await this.getIdempotentResult<DissolveDiningGroupResponse>(
          operationId,
          dissolveDiningGroupOperation,
          userId,
          diningGroupId,
          requestHash
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async buildDiningGroupSummary(
    db: Prisma.TransactionClient | PrismaService,
    diningGroupId: UUID,
    membership: Pick<DiningGroupMember, "id" | "diningGroupId" | "role" | "status" | "statusReason" | "joinedAt" | "restrictedAt" | "endedAt" | "version" | "userId"> & {
      diningGroup?: DiningGroupWithOwnerUid;
    }
  ): Promise<DiningGroupSummary> {
    const diningGroup =
      membership.diningGroup ??
      (await db.diningGroup.findUnique({
        where: { id: diningGroupId },
        include: { owner: { select: { uid: true } } }
      }));
    if (!diningGroup || diningGroup.status !== "ACTIVE") throw new NotFoundException("饭搭子不存在");

    const [memberCount, ownerEntitlements] = await Promise.all([
      db.diningGroupMember.count({
        where: {
          diningGroupId,
          status: { in: activeStatuses }
        }
      }),
      this.entitlementService.resolveForUser(db, diningGroup.ownerId)
    ]);

    return {
      id: diningGroup.id,
      name: diningGroup.name,
      ownerUid: diningGroup.owner.uid,
      isOwned: diningGroup.ownerId === membership.userId,
      myRole: membership.role,
      myStatus: membership.status,
      myStatusReason: membership.statusReason,
      memberCount,
      memberLimit: ownerEntitlements.memberLimit,
      state: memberCount > ownerEntitlements.memberLimit ? "OVER_MEMBER_LIMIT" : "NORMAL",
      version: diningGroup.version,
      createdAt: toIsoDate(diningGroup.createdAt),
      updatedAt: toIsoDate(diningGroup.updatedAt)
    };
  }

  private async requireActiveMembership(
    db: Prisma.TransactionClient | PrismaService,
    userId: UUID,
    diningGroupId: UUID
  ) {
    const member = await db.diningGroupMember.findUnique({
      where: {
        diningGroupId_userId: {
          diningGroupId,
          userId
        }
      }
    });
    if (!member || !activeStatuses.includes(member.status)) {
      throw new NotFoundException("饭搭子不存在");
    }

    const diningGroup = await db.diningGroup.findUnique({
      where: { id: diningGroupId },
      select: { status: true }
    });
    if (!diningGroup || diningGroup.status !== "ACTIVE") {
      throw new NotFoundException("饭搭子不存在");
    }

    return member;
  }

  private async requireOwnerMembership(
    db: Prisma.TransactionClient | PrismaService,
    userId: UUID,
    diningGroupId: UUID
  ) {
    const member = await this.requireActiveMembership(db, userId, diningGroupId);
    if (member.role !== "OWNER") {
      throw new ForbiddenException("无权操作该饭搭子");
    }
    return member;
  }

  private async assertGroupVersion(tx: Prisma.TransactionClient, diningGroupId: UUID, expectedVersion: number) {
    const diningGroup = await tx.diningGroup.findUnique({
      where: { id: diningGroupId },
      select: { version: true }
    });
    if (!diningGroup) throw new NotFoundException("饭搭子不存在");
    if (diningGroup.version !== expectedVersion) {
      throw new ConflictException("饭搭子已被更新，请刷新后重试");
    }
  }

  private toMemberSummary(member: MemberWithUser): DiningGroupMemberSummary {
    return {
      id: member.id,
      diningGroupId: member.diningGroupId,
      user: {
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
    if (record.requestHash !== requestHash) throw new ConflictException("operationId 已用于其他请求");
    return record.status === "SUCCEEDED" && record.resultJson ? fromJson<T>(record.resultJson) : null;
  }

  private startIdempotentOperation(
    tx: Prisma.TransactionClient,
    operationId: UUID,
    operationType: string,
    userId: UUID,
    diningGroupId: UUID | null,
    requestHash: string
  ) {
    return tx.idempotencyRecord.create({
      data: {
        operationId,
        operationType,
        userId,
        diningGroupId,
        requestHash,
        status: "PROCESSING"
      }
    });
  }

  private completeIdempotentOperation<T>(
    tx: Prisma.TransactionClient,
    operationId: UUID,
    operationType: string,
    userId: UUID,
    diningGroupId: UUID | null,
    requestHash: string,
    result: T
  ) {
    return tx.idempotencyRecord.updateMany({
      where: {
        operationId,
        operationType,
        userId,
        diningGroupId,
        requestHash,
        status: "PROCESSING"
      },
      data: {
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
    payload: Record<string, unknown>
  ) {
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorUserId: userId,
        action,
        objectType: "DINING_GROUP",
        objectId: diningGroupId,
        diningGroupId,
        payload: toJson(payload)
      }
    });
    await tx.outboxEvent.create({
      data: {
        eventType: action,
        aggregateType: "DINING_GROUP",
        aggregateId: diningGroupId,
        payload: toJson(payload)
      }
    });
  }

  private isUniqueError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
