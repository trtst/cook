import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { AdminDashboardTrendPoint, AdminDashboardTrendsResponse, UUID } from "../../contracts/types";

type DailyCountRow = {
  day: Date;
  count: number;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, offset: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + offset);
  return next;
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toLabel(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function rowsToMap(rows: DailyCountRow[]) {
  return new Map(rows.map(row => [toDateKey(new Date(row.day)), Number(row.count)]));
}

@Injectable()
export class AdminDashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getTrends(adminId: UUID, range: "7D" | "30D" = "7D"): Promise<AdminDashboardTrendsResponse> {
    await this.requireSuperAdmin(adminId);

    const days = range === "30D" ? 30 : 7;
    const today = startOfDay(new Date());
    const startDay = addDays(today, -(days - 1));
    const endDay = addDays(today, 1);

    const [
      userBaseCount,
      reportBaseCount,
      pendingRecipeBaseCount,
      pendingIngredientBaseCount,
      newUsersRows,
      reportCreatedRows,
      reportResolvedRows,
      pendingRecipeCreatedRows,
      pendingRecipeReviewedRows,
      pendingRecipeWithdrawnRows,
      pendingIngredientCreatedRows,
      pendingIngredientReviewedRows,
      membershipGeneratedRows,
      membershipRedeemedRows
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { lt: startDay } } }),
      this.prisma.recipeReport.count({
        where: {
          createdAt: { lt: startDay },
          OR: [{ resolvedAt: null }, { resolvedAt: { gte: startDay } }]
        }
      }),
      this.prisma.recipeRecommendation.count({
        where: {
          createdAt: { lt: startDay },
          AND: [
            { OR: [{ reviewedAt: null }, { reviewedAt: { gte: startDay } }] },
            { OR: [{ withdrawnAt: null }, { withdrawnAt: { gte: startDay } }] }
          ]
        }
      }),
      this.prisma.ingredientRecommendation.count({
        where: {
          createdAt: { lt: startDay },
          OR: [{ reviewedAt: null }, { reviewedAt: { gte: startDay } }]
        }
      }),
      this.dailyCount("users", "created_at", startDay, endDay),
      this.dailyCount("recipe_reports", "created_at", startDay, endDay),
      this.dailyCount("recipe_reports", "resolved_at", startDay, endDay),
      this.dailyCount("recipe_recommendations", "created_at", startDay, endDay),
      this.dailyCount("recipe_recommendations", "reviewed_at", startDay, endDay),
      this.dailyCount("recipe_recommendations", "withdrawn_at", startDay, endDay),
      this.dailyCount("ingredient_recommendations", "created_at", startDay, endDay),
      this.dailyCount("ingredient_recommendations", "reviewed_at", startDay, endDay),
      this.auditDailyCount("membership-code.generate", startDay, endDay),
      this.dailyCount("membership_codes", "redeemed_at", startDay, endDay)
    ]);

    const newUsersMap = rowsToMap(newUsersRows);
    const reportCreatedMap = rowsToMap(reportCreatedRows);
    const reportResolvedMap = rowsToMap(reportResolvedRows);
    const pendingRecipeCreatedMap = rowsToMap(pendingRecipeCreatedRows);
    const pendingRecipeReviewedMap = rowsToMap(pendingRecipeReviewedRows);
    const pendingRecipeWithdrawnMap = rowsToMap(pendingRecipeWithdrawnRows);
    const pendingIngredientCreatedMap = rowsToMap(pendingIngredientCreatedRows);
    const pendingIngredientReviewedMap = rowsToMap(pendingIngredientReviewedRows);
    const membershipGeneratedMap = rowsToMap(membershipGeneratedRows);
    const membershipRedeemedMap = rowsToMap(membershipRedeemedRows);

    let totalUsers = userBaseCount;
    let openReports = reportBaseCount;
    let pendingRecipes = pendingRecipeBaseCount;
    let pendingIngredients = pendingIngredientBaseCount;

    const points: AdminDashboardTrendPoint[] = [];

    for (let index = 0; index < days; index += 1) {
      const currentDay = addDays(startDay, index);
      const key = toDateKey(currentDay);
      const newUsers = newUsersMap.get(key) ?? 0;
      const reportCreated = reportCreatedMap.get(key) ?? 0;
      const reportResolved = reportResolvedMap.get(key) ?? 0;
      const pendingRecipeCreated = pendingRecipeCreatedMap.get(key) ?? 0;
      const pendingRecipeReviewed = pendingRecipeReviewedMap.get(key) ?? 0;
      const pendingRecipeWithdrawn = pendingRecipeWithdrawnMap.get(key) ?? 0;
      const pendingIngredientCreated = pendingIngredientCreatedMap.get(key) ?? 0;
      const pendingIngredientReviewed = pendingIngredientReviewedMap.get(key) ?? 0;

      totalUsers += newUsers;
      openReports += reportCreated - reportResolved;
      pendingRecipes += pendingRecipeCreated - pendingRecipeReviewed - pendingRecipeWithdrawn;
      pendingIngredients += pendingIngredientCreated - pendingIngredientReviewed;

      points.push({
        date: key,
        label: toLabel(currentDay),
        newUsers,
        totalUsers,
        openReportCount: Math.max(0, openReports),
        pendingRecipeCount: Math.max(0, pendingRecipes),
        pendingIngredientCount: Math.max(0, pendingIngredients),
        membershipGeneratedCount: membershipGeneratedMap.get(key) ?? 0,
        membershipRedeemedCount: membershipRedeemedMap.get(key) ?? 0
      });
    }

    return {
      range,
      points
    };
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

  private dailyCount(tableName: string, columnName: string, startAt: Date, endAt: Date) {
    const table = Prisma.raw(`"${tableName}"`);
    const column = Prisma.raw(`"${columnName}"`);

    return this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
      select date_trunc('day', ${column})::date as day, count(*)::int as count
      from ${table}
      where ${column} >= ${startAt} and ${column} < ${endAt}
      group by 1
      order by 1 asc
    `);
  }

  private auditDailyCount(action: string, startAt: Date, endAt: Date) {
    return this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
      select date_trunc('day', "created_at")::date as day, count(*)::int as count
      from "audit_events"
      where "action" = ${action}
        and "created_at" >= ${startAt}
        and "created_at" < ${endAt}
      group by 1
      order by 1 asc
    `);
  }
}
