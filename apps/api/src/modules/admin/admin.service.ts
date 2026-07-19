import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Prisma, DiningGroupStatus } from "@prisma/client";
import type { AdminLoginRequest, PageResult, DiningGroupSummary, UserProfile } from "@next-meal/api-client";
import { PrismaService } from "../../common/prisma.service";
import { AdminTokenService } from "../../common/security/admin-token.service";
import { verifyPassword } from "../../common/security/password";

function toIsoDate(value: Date) {
  return value.toISOString();
}

function getDefaultMembership() {
  return {
    tier: "FREE",
    status: "ACTIVE",
    skinEntitlements: [] as string[],
    expiresAt: null
  };
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AdminTokenService)
    private readonly adminTokenService: AdminTokenService
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
        membership: getDefaultMembership(),
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
  ): Promise<PageResult<DiningGroupSummary>> {
    const normalizedPage = page ?? 1;
    const normalizedPageSize = pageSize ?? 20;
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();

    if (normalizedStatus && normalizedStatus !== "ACTIVE" && normalizedStatus !== "ARCHIVED") {
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
          collaborationMode: diningGroup.collaborationMode,
          sharedQuotaPolicy: diningGroup.sharedQuotaPolicy,
          memberLimit: diningGroup.memberLimit,
          status: diningGroup.status,
          version: diningGroup.version,
          myRole: "OWNER",
          myMemberStatus: "ACTIVE",
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
}
