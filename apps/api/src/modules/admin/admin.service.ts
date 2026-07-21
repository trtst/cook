import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { Prisma, DiningGroupStatus } from "@prisma/client";
import type {
  AdminDiningGroupSummary,
  AdminLoginRequest,
  AdminUserEntitlementResponse,
  PageResult,
  UserProfile,
  UUID
} from "@next-meal/api-client";
import { PrismaService } from "../../common/prisma.service";
import { AdminTokenService } from "../../common/security/admin-token.service";
import { verifyPassword } from "../../common/security/password";
import { EntitlementService } from "../entitlement/entitlement.service";

function toIsoDate(value: Date) {
  return value.toISOString();
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
    const normalizedPage = page ?? 1;
    const normalizedPageSize = pageSize ?? 20;
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where = keyword
      ? {
          OR: [
            { nickname: { contains: keyword, mode: "insensitive" as const } },
            { phone: { contains: keyword, mode: "insensitive" as const } }
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
      items: items.map(user => ({
        id: user.id,
        uid: user.uid,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        status: user.status,
        createdAt: toIsoDate(user.createdAt),
        updatedAt: toIsoDate(user.updatedAt)
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listDiningGroups(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string
  ): Promise<PageResult<AdminDiningGroupSummary>> {
    const normalizedPage = page ?? 1;
    const normalizedPageSize = pageSize ?? 20;
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();

    if (normalizedStatus && !["ACTIVE", "FROZEN", "ARCHIVED"].includes(normalizedStatus)) {
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
          select: { members: true }
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
          status: true,
          space: {
            select: {
              currentDiningGroup: {
                select: { id: true, name: true, ownerId: true, status: true }
              }
            }
          }
        }
      });
      if (!user) throw new NotFoundException("用户不存在");

      const currentSpace = user.space?.currentDiningGroup;
      if (!currentSpace || currentSpace.status !== "ACTIVE") {
        throw new BadRequestException("用户当前空间关系无效");
      }

      const [member, memberCount] = await Promise.all([
        tx.diningGroupMember.findUnique({
          where: { diningGroupId_userId: { diningGroupId: currentSpace.id, userId } },
          select: { status: true }
        }),
        tx.diningGroupMember.count({
          where: { diningGroupId: currentSpace.id, status: "ACTIVE" }
        })
      ]);
      if (!member || member.status === "ENDED") {
        throw new BadRequestException("用户当前成员关系无效");
      }

      const entitlements = await this.entitlementService.resolve(tx, {
        userId,
        diningGroupId: currentSpace.id,
        ownerId: currentSpace.ownerId,
        memberCount
      });

      return {
        user: {
          id: user.id,
          uid: user.uid,
          nickname: user.nickname,
          status: user.status
        },
        currentSpace: {
          id: currentSpace.id,
          name: currentSpace.name
        },
        entitlements
      };
    });
  }
}
