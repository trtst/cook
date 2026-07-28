import type { RecipeContentSnapshot, RecipeDraftContentInput } from "../../contracts/types";

export function replaceDraftIngredient(content: RecipeDraftContentInput, fromId: string, toId: string) {
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
  fromId: string,
  target: { id: string; name: string; categoryId: string }
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
