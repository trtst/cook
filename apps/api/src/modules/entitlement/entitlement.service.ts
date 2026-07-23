import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type EntitlementTier as DbEntitlementTier, type LongTermMemberStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import type { EntitlementTier, RelationshipState, ResolvedPolicy, UUID } from "../../contracts/types";

type EntitlementDb = Pick<Prisma.TransactionClient, "entitlementGrant" | "diningGroupMember" | "diningGroup">;

const activeStatuses: LongTermMemberStatus[] = ["ACTIVE", "RESTRICTED"];

function mapTier(tier: DbEntitlementTier | null | undefined): EntitlementTier {
  return tier ?? "FREE";
}

@Injectable()
export class EntitlementService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveForUser(db: EntitlementDb, userId: UUID, now = new Date()): Promise<ResolvedPolicy> {
    const [grant, ownedDiningGroupCount, joinedDiningGroupCount] = await Promise.all([
      db.entitlementGrant.findFirst({
        where: {
          userId,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }]
        },
        orderBy: { startsAt: "desc" },
        select: { tier: true, endsAt: true }
      }),
      db.diningGroup.count({ where: { ownerId: userId, status: "ACTIVE" } }),
      db.diningGroupMember.count({
        where: {
          userId,
          status: { in: activeStatuses },
          diningGroup: { status: "ACTIVE" }
        }
      })
    ]);

    const tier = mapTier(grant?.tier);
    const state: RelationshipState = joinedDiningGroupCount > policy.joinLimit[tier] ? "OVER_MEMBER_LIMIT" : "NORMAL";

    return {
      tier,
      validUntil: grant?.endsAt?.toISOString() ?? null,
      recipeLimit: policy.recipeLimit[tier],
      inviteLimit: policy.inviteLimit[tier],
      joinLimit: policy.joinLimit[tier],
      memberLimit: policy.memberLimit[tier],
      storageLimitBytes: policy.storageLimitBytes[tier],
      recycleDays: policy.recycleDays[tier],
      variantLimitPerRoot: policy.variantLimit[tier],
      imagePolicy: policy.image[tier],
      ownedDiningGroupCount,
      joinedDiningGroupCount,
      state
    };
  }

  async getTier(db: EntitlementDb, userId: UUID, now = new Date()): Promise<EntitlementTier> {
    const grant = await db.entitlementGrant.findFirst({
      where: {
        userId,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }]
      },
      orderBy: { startsAt: "desc" },
      select: { tier: true }
    });

    return mapTier(grant?.tier);
  }
}
