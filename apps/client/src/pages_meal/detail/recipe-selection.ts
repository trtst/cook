import type { UUID } from "@/apis/http";

export function toggleWishRecipeSelection(
  selectedIds: readonly UUID[],
  recipeId: UUID,
  supportedRecipeIds: ReadonlySet<UUID>,
  maxSelection: number
) {
  if (supportedRecipeIds.has(recipeId)) return [...selectedIds];
  if (selectedIds.includes(recipeId)) return selectedIds.filter(id => id !== recipeId);
  if (selectedIds.length >= maxSelection) return [...selectedIds];
  return [...selectedIds, recipeId];
}
