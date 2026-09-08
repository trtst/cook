import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const recipeInspirationOwnerCount = 100;

export function pickInspirationOwnerId(ownerIds: number[]) {
  if (ownerIds.length !== recipeInspirationOwnerCount) {
    throw new Error(`灵感菜谱归属用户池必须正好包含 ${recipeInspirationOwnerCount} 个用户`);
  }
  if (new Set(ownerIds).size !== recipeInspirationOwnerCount) {
    throw new Error(`灵感菜谱归属用户池必须包含 ${recipeInspirationOwnerCount} 个不同用户`);
  }
  return ownerIds[randomInt(0, ownerIds.length)] as number;
}

export function isPublicInspirationRecipe(recipe: {
  isInspiration: boolean;
  inspirationCategoryId: number | null;
  status: string;
}) {
  return recipe.isInspiration && recipe.inspirationCategoryId !== null && recipe.status === "ACTIVE";
}

export async function pickRecipeInspirationOwner(tx: Prisma.TransactionClient) {
  const rows = await tx.recipeInspirationOwner.findMany({
    where: { user: { status: "ACTIVE" } },
    select: { userId: true },
    orderBy: { userId: "asc" }
  });
  return pickInspirationOwnerId(rows.map(item => item.userId));
}

export function inspirationRecipeWhere(status: "ACTIVE" | "BLOCKED" | "RECYCLED" | "DELETED" = "ACTIVE") {
  return {
    isInspiration: true,
    inspirationCategoryId: { not: null },
    status
  } satisfies Prisma.RecipeWhereInput;
}
