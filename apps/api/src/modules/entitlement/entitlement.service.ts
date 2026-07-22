import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import type { EffectiveEntitlementSnapshot, EntitlementTier, UUID } from "../../contracts/types";

type EntitlementDb = Pick<Prisma.TransactionClient, "entitlementGrant">;

interface EntitlementContext {
  userId: UUID;
  diningGroupId: UUID;
  ownerId: UUID;
  memberCount: number;
}

@Injectable()
export class EntitlementService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getCurrent(userId: UUID) {
    return this.prisma.$transaction(async tx => {
      const userSpace = await tx.userSpace.findUnique({
        where: { userId },
        include: { currentDiningGroup: true }
      });
      if (!userSpace) throw new BadRequestException("当前账号尚未初始化单人空间");

      const [member, memberCount] = await Promise.all([
        tx.diningGroupMember.findUnique({
          where: { diningGroupId_userId: { diningGroupId: userSpace.currentDiningGroupId, userId } }
        }),
        tx.diningGroupMember.count({
          where: { diningGroupId: userSpace.currentDiningGroupId, status: "ACTIVE" }
        })
      ]);
      if (!member || member.status === "ENDED") throw new BadRequestException("当前空间成员关系无效");

      return this.resolve(tx, {
        userId,
        diningGroupId: userSpace.currentDiningGroupId,
        ownerId: userSpace.currentDiningGroup.ownerId,
        memberCount
      });
    });
  }

  async resolve(db: EntitlementDb, context: EntitlementContext, now = new Date()): Promise<EffectiveEntitlementSnapshot> {
    const grants = await db.entitlementGrant.findMany({
      where: {
        AND: [
          { OR: [{ userId: context.userId }, { diningGroupId: context.diningGroupId }] },
          { startsAt: { lte: now } },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
        ]
      },
      select: { userId: true, diningGroupId: true }
    });

    const groupPlus = grants.some(grant => grant.diningGroupId === context.diningGroupId);
    const directPlus = grants.some(grant => grant.userId === context.userId);
    const personalPlus = directPlus || (groupPlus && context.ownerId === context.userId);
    const personalTier: EntitlementTier = personalPlus ? "PLUS" : "FREE";
    const diningGroupTier: EntitlementTier = groupPlus ? "PLUS" : "FREE";
    const groupScope = context.memberCount > 1 || groupPlus;
    const currentScope = groupScope ? "DINING_GROUP" : "USER";
    const scopeTier = groupScope ? diningGroupTier : personalTier;
    const actionTier: EntitlementTier = personalPlus || groupPlus ? "PLUS" : "FREE";

    return {
      personalTier,
      diningGroupTier,
      currentScope,
      recipeLimit: policy.recipeLimit[currentScope][scopeTier],
      memberLimit: groupScope ? policy.memberLimit[diningGroupTier] : null,
      storageLimitBytes: policy.storageLimitBytes[currentScope][scopeTier],
      snapshotDays: policy.snapshotDays[personalTier],
      recycleDays: policy.recycleDays[scopeTier],
      variantLimitPerRoot: policy.variantLimit[actionTier],
      imagePolicy: policy.image[actionTier]
    };
  }

  async getMemberLimit(db: EntitlementDb, diningGroupId: UUID, now = new Date()) {
    const plusGrant = await db.entitlementGrant.findFirst({
      where: {
        diningGroupId,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }]
      },
      select: { id: true }
    });

    return policy.memberLimit[plusGrant ? "PLUS" : "FREE"];
  }
}
