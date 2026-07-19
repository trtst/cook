import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AcceptInviteResult,
  CreateDiningGroupResult,
  CreateInviteResult,
  DiningGroupMemberSummary,
  DiningGroupMembersResult,
  DiningGroupSummary,
  MyDiningGroupsResult
} from "@next-meal/api-client";
import { Prisma, type DiningGroup, type DiningGroupMember, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";

const activeMemberStatus = "ACTIVE";
const activeInviteStatus = "ACTIVE";
const ownedLimit = 1;
const joinedLimit = 3;
const freeMemberLimit = 4;
const inviteExpiresMs = 24 * 60 * 60 * 1000;
const inviteTokenBytes = 32;
const createDiningGroupOperationType = "dining-group:create";
const createInviteOperationType = "dining-group-invite:create";
const acceptInviteOperationType = "dining-group-invite:accept";
const invalidInviteMessage = "邀请已失效";

function toIsoDate(value: Date) {
  return value.toISOString();
}

function createOpaqueInviteToken() {
  return randomBytes(inviteTokenBytes).toString("base64url");
}

function hashInviteToken(inviteToken: string) {
  return createHash("sha256").update(inviteToken).digest("hex");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function fromJson<T>(value: unknown): T {
  return value as T;
}

type DiningGroupWithMember = DiningGroup & {
  members: DiningGroupMember[];
  _count: { members: number };
};

type MemberWithUser = DiningGroupMember & {
  user: Pick<User, "id" | "uid" | "nickname" | "avatarUrl">;
};

@Injectable()
export class DiningGroupService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listMine(userId: string): Promise<MyDiningGroupsResult> {
    const memberships = await this.prisma.diningGroupMember.findMany({
      where: {
        userId,
        status: activeMemberStatus
      },
      orderBy: { createdAt: "asc" },
      include: {
        diningGroup: {
          include: {
            members: {
              where: { userId },
              take: 1
            },
            _count: {
              select: { members: true }
            }
          }
        }
      }
    });

    const diningGroups = memberships.map(member => this.toDiningGroupSummary(member.diningGroup, member));

    return {
      diningGroups,
      currentDiningGroupId: diningGroups[0]?.id ?? null,
      limits: {
        ownedLimit,
        joinedLimit,
        freeMemberLimit
      }
    };
  }

  async create(userId: string, name: string, operationId: string): Promise<CreateDiningGroupResult> {
    const existingResult = await this.getUserIdempotentResult<CreateDiningGroupResult>(
      operationId,
      createDiningGroupOperationType,
      userId
    );

    if (existingResult) {
      return existingResult;
    }

    try {
      return await this.prisma.$transaction(async tx => {
        const existingOwnedCount = await tx.diningGroup.count({
          where: {
            ownerId: userId,
            status: activeMemberStatus
          }
        });

        if (existingOwnedCount >= ownedLimit) {
          throw new BadRequestException("每个用户最多创建 1 个饭搭子");
        }

        const diningGroup = await tx.diningGroup.create({
          data: {
            name,
            ownerId: userId,
            status: "ACTIVE"
          }
        });
        const ownerMember = await tx.diningGroupMember.create({
          data: {
            diningGroupId: diningGroup.id,
            userId,
            role: "OWNER",
            status: activeMemberStatus,
            joinedAt: new Date()
          },
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

        const result = {
          diningGroup: this.toDiningGroupSummary(
            {
              ...diningGroup,
              members: [ownerMember],
              _count: { members: 1 }
            },
            ownerMember
          ),
          ownerMember: this.toMemberSummary(ownerMember)
        };

        await tx.idempotencyRecord.create({
          data: {
            operationId,
            operationType: createDiningGroupOperationType,
            userId,
            diningGroupId: diningGroup.id,
            resultJson: toJson(result)
          }
        });

        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const repeatedResult = await this.getUserIdempotentResult<CreateDiningGroupResult>(
          operationId,
          createDiningGroupOperationType,
          userId
        );

        if (repeatedResult) {
          return repeatedResult;
        }

        throw new BadRequestException("每个用户最多创建 1 个饭搭子");
      }

      throw error;
    }
  }

  async get(userId: string, diningGroupId: string): Promise<DiningGroupSummary> {
    const membership = await this.getActiveMembership(userId, diningGroupId);
    const diningGroup = await this.prisma.diningGroup.findUnique({
      where: { id: diningGroupId },
      include: {
        members: {
          where: { userId },
          take: 1
        },
        _count: {
          select: { members: true }
        }
      }
    });

    if (!diningGroup || diningGroup.status !== "ACTIVE") {
      throw new NotFoundException("饭搭子不存在");
    }

    return this.toDiningGroupSummary(diningGroup, membership);
  }

  async listMembers(userId: string, diningGroupId: string): Promise<DiningGroupMembersResult> {
    await this.getActiveMembership(userId, diningGroupId);

    const members = await this.prisma.diningGroupMember.findMany({
      where: {
        diningGroupId,
        status: activeMemberStatus
      },
      orderBy: { createdAt: "asc" },
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

  async createInvite(userId: string, diningGroupId: string, operationId: string): Promise<CreateInviteResult> {
    const membership = await this.getActiveMembership(userId, diningGroupId);

    if (membership.role === "MEMBER") {
      throw new ForbiddenException("无权邀请成员");
    }

    const existingResult = await this.getIdempotentResult<CreateInviteResult>(
      operationId,
      createInviteOperationType,
      userId,
      diningGroupId
    );

    if (existingResult) {
      return existingResult;
    }

    const expiresAt = new Date(Date.now() + inviteExpiresMs);
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
            tokenHash: hashInviteToken(inviteToken),
            status: activeInviteStatus,
            expiresAt
          }
        });
        await tx.idempotencyRecord.create({
          data: {
            operationId,
            operationType: createInviteOperationType,
            userId,
            diningGroupId,
            resultJson: toJson(result)
          }
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const repeatedResult = await this.getIdempotentResult<CreateInviteResult>(
          operationId,
          createInviteOperationType,
          userId,
          diningGroupId
        );

        if (repeatedResult) {
          return repeatedResult;
        }
      }

      throw error;
    }

    return result;
  }

  async acceptInvite(userId: string, inviteToken: string, operationId: string): Promise<AcceptInviteResult> {
    const invite = await this.prisma.diningGroupInvite.findFirst({
      where: {
        tokenHash: hashInviteToken(inviteToken)
      },
      select: {
        diningGroupId: true,
        expiresAt: true,
        status: true
      }
    });

    if (!invite) {
      throw new BadRequestException(invalidInviteMessage);
    }

    const existingResult = await this.getIdempotentResult<AcceptInviteResult>(
      operationId,
      acceptInviteOperationType,
      userId,
      invite.diningGroupId
    );

    if (existingResult) {
      return existingResult;
    }

    if (invite.status !== activeInviteStatus || invite.expiresAt <= new Date()) {
      throw new BadRequestException(invalidInviteMessage);
    }

    try {
      return await this.prisma.$transaction(async tx => {
        const currentInvite = await tx.diningGroupInvite.findFirst({
          where: {
            tokenHash: hashInviteToken(inviteToken)
          },
          select: {
            diningGroupId: true,
            expiresAt: true,
            status: true
          }
        });

        if (
          !currentInvite ||
          currentInvite.status !== activeInviteStatus ||
          currentInvite.expiresAt <= new Date()
        ) {
          throw new BadRequestException(invalidInviteMessage);
        }

        await tx.$queryRaw`SELECT "id" FROM "dining_groups" WHERE "id" = ${currentInvite.diningGroupId}::uuid FOR UPDATE`;

        const diningGroup = await tx.diningGroup.findUnique({
          where: { id: currentInvite.diningGroupId }
        });

        if (!diningGroup || diningGroup.status !== "ACTIVE") {
          throw new NotFoundException("饭搭子不存在");
        }

        const existingMember = await tx.diningGroupMember.findUnique({
          where: {
            diningGroupId_userId: {
              diningGroupId: currentInvite.diningGroupId,
              userId
            }
          },
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

        const activeMemberCount = await tx.diningGroupMember.count({
          where: {
            diningGroupId: currentInvite.diningGroupId,
            status: activeMemberStatus
          }
        });

        if (existingMember?.status !== activeMemberStatus && activeMemberCount >= diningGroup.memberLimit) {
          throw new BadRequestException("饭搭子成员已达上限");
        }

        const member =
          existingMember?.status === activeMemberStatus
            ? existingMember
            : existingMember
              ? await tx.diningGroupMember.update({
                  where: { id: existingMember.id },
                  data: {
                    role: existingMember.role === "OWNER" ? "OWNER" : "MEMBER",
                    status: activeMemberStatus,
                    joinedAt: new Date(),
                    version: { increment: 1 }
                  },
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
                })
              : await tx.diningGroupMember.create({
                  data: {
                    diningGroupId: currentInvite.diningGroupId,
                    userId,
                    role: "MEMBER",
                    status: activeMemberStatus,
                    joinedAt: new Date()
                  },
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

        const result = {
          diningGroup: this.toDiningGroupSummary(
            {
              ...diningGroup,
              members: [member],
              _count: { members: existingMember?.status === activeMemberStatus ? activeMemberCount : activeMemberCount + 1 }
            },
            member
          ),
          member: this.toMemberSummary(member)
        };

        await tx.idempotencyRecord.create({
          data: {
            operationId,
            operationType: acceptInviteOperationType,
            userId,
            diningGroupId: currentInvite.diningGroupId,
            resultJson: toJson(result)
          }
        });

        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const repeatedResult = await this.getIdempotentResult<AcceptInviteResult>(
          operationId,
          acceptInviteOperationType,
          userId,
          invite.diningGroupId
        );

        if (repeatedResult) {
          return repeatedResult;
        }
      }

      throw error;
    }
  }

  private async getIdempotentResult<T>(
    operationId: string,
    operationType: string,
    userId: string,
    diningGroupId: string
  ): Promise<T | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: {
        operationId_operationType_userId_diningGroupId: {
          operationId,
          operationType,
          userId,
          diningGroupId
        }
      },
      select: {
        resultJson: true
      }
    });

    return record ? fromJson<T>(record.resultJson) : null;
  }

  private async getUserIdempotentResult<T>(
    operationId: string,
    operationType: string,
    userId: string
  ): Promise<T | null> {
    const record = await this.prisma.idempotencyRecord.findFirst({
      where: {
        operationId,
        operationType,
        userId
      },
      orderBy: { createdAt: "asc" },
      select: {
        resultJson: true
      }
    });

    return record ? fromJson<T>(record.resultJson) : null;
  }

  private async getActiveMembership(userId: string, diningGroupId: string) {
    const membership = await this.prisma.diningGroupMember.findUnique({
      where: {
        diningGroupId_userId: {
          diningGroupId,
          userId
        }
      }
    });

    if (!membership || membership.status !== activeMemberStatus) {
      throw new NotFoundException("饭搭子不存在");
    }

    return membership;
  }

  private toDiningGroupSummary(diningGroup: DiningGroupWithMember, member: DiningGroupMember): DiningGroupSummary {
    return {
      id: diningGroup.id,
      name: diningGroup.name,
      ownerId: diningGroup.ownerId,
      collaborationMode: diningGroup.collaborationMode,
      sharedQuotaPolicy: diningGroup.sharedQuotaPolicy,
      memberLimit: diningGroup.memberLimit,
      status: diningGroup.status,
      version: diningGroup.version,
      myRole: member.role,
      myMemberStatus: member.status,
      memberCount: diningGroup._count.members,
      createdAt: toIsoDate(diningGroup.createdAt),
      updatedAt: toIsoDate(diningGroup.updatedAt)
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
      joinedAt: member.joinedAt ? toIsoDate(member.joinedAt) : null,
      invitedAt: member.invitedAt ? toIsoDate(member.invitedAt) : null,
      version: member.version
    };
  }
}
