/**
 * 菜谱分包采购清单展示工具。
 *
 * 菜谱详情只在 `pages_recipe` 内消费默认清单名，
 * 分包内维护副本可以避免根 `utils` 生成主包未使用文件。
 */
import type { UUID } from "@/apis/http";

export function buildDefaultShoppingListName(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日 · 采购清单`;
}

export function buildMealShoppingListName(mealLabel: string | null | undefined, date = new Date()) {
  const normalizedMealLabel = mealLabel?.trim();
  if (!normalizedMealLabel) {
    return buildDefaultShoppingListName(date);
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${normalizedMealLabel}清单`;
}

export type MealShoppingLink = {
  shoppingListId: UUID | null;
  shoppingListName: string | null;
  shoppingListStatus: "ACTIVE" | "COMPLETED" | "VOIDED" | null;
};

export function hasShoppingListLink(target: MealShoppingLink | null | undefined) {
  return Boolean(target?.shoppingListId);
}

export function hasActiveShoppingListLink(target: MealShoppingLink | null | undefined) {
  return Boolean(target?.shoppingListId && target.shoppingListStatus === "ACTIVE");
}

export function buildShoppingListDetailPath(listId: UUID) {
  return `/pages_pantry/list-detail/index?id=${encodeURIComponent(String(listId))}`;
}
