import { Prisma } from "@prisma/client";

type RecipeVersionIngredientDb = Pick<Prisma.TransactionClient, "recipeVersionIngredient">;

// 正文版本创建后同步建立倒排索引，供首页推荐按食材分批读取菜谱。
export async function indexRecipeVersionIngredients(
  tx: RecipeVersionIngredientDb,
  recipeVersionId: number,
  ingredientsJson: Prisma.JsonValue
) {
  if (!Array.isArray(ingredientsJson)) return;

  const ingredientIds = Array.from(new Set(ingredientsJson.flatMap(item => {
    if (typeof item !== "object" || item === null || !("ingredientId" in item)) return [];
    const ingredientId = Number(item.ingredientId);
    return Number.isInteger(ingredientId) && ingredientId > 0 ? [ingredientId] : [];
  })));
  if (!ingredientIds.length) return;

  await tx.recipeVersionIngredient.createMany({
    data: ingredientIds.map(ingredientId => ({ recipeVersionId, ingredientId })),
    skipDuplicates: true
  });
}
