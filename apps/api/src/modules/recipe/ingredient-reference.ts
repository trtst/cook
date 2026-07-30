import type { RecipeContentSnapshot, RecipeDraftContentInput, UUID } from "../../contracts/types";

export function replaceDraftIngredient(content: RecipeDraftContentInput, fromId: UUID, toId: UUID) {
  let changed = false;
  const ingredients = content.ingredients.map(item => {
    if (item.ingredientId !== fromId) return item;
    changed = true;
    return {
      ...item,
      ingredientId: toId
    };
  });

  return {
    changed,
    content: changed
      ? {
          ...content,
          ingredients
        }
      : content
  };
}

export function replaceRecipeIngredient(
  content: RecipeContentSnapshot,
  fromId: UUID,
  target: { id: UUID; name: string; categoryId: UUID }
) {
  let changed = false;
  const ingredients = content.ingredients.map(item => {
    if (item.ingredientId !== fromId) return item;
    changed = true;
    return {
      ...item,
      ingredientId: target.id,
      ingredientName: target.name,
      source: "SYSTEM" as const,
      categoryId: target.categoryId
    };
  });

  return {
    changed,
    content: changed
      ? {
          ...content,
          ingredients
        }
      : content
  };
}
