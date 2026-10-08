import type { Prisma } from "@prisma/client";

// 食材归并后只清理确实引用源食材的用户缓存，避免无关用户被迫重建推荐。
export async function invalidateMergedIngredientRecommendationCaches(
  tx: Prisma.TransactionClient,
  sourceIngredientIds: number[]
) {
  const users = await tx.fridgeTrace.findMany({
    where: { ingredientId: { in: sourceIngredientIds } },
    distinct: ["userId"],
    select: { userId: true }
  });
  if (!users.length) return;
  await tx.homeFridgeRecommendationCache.deleteMany({
    where: { userId: { in: users.map(item => item.userId) } }
  });
}
