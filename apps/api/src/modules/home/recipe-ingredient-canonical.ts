// 兼容历史菜谱中的旧食材引用，避免归并前后的 ID 被重复计算。
export function canonicalRecipeIngredientIds(
  ingredientIds: Iterable<number>,
  mergedTargets: ReadonlyMap<number, number>
) {
  return Array.from(new Set(Array.from(ingredientIds, id => mergedTargets.get(id) ?? id)))
    .sort((left, right) => left - right);
}
