import type { RecipeDraftContentInput, UUID } from "../../contracts/types";

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
