import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const publicContentUserPoolSize = 100;

export function pickPublicContentOwnerId(ownerIds: number[]) {
  if (ownerIds.length !== publicContentUserPoolSize) {
    throw new Error(`公共内容用户池必须正好包含 ${publicContentUserPoolSize} 个用户`);
  }
  if (new Set(ownerIds).size !== publicContentUserPoolSize) {
    throw new Error(`公共内容用户池必须包含 ${publicContentUserPoolSize} 个不同用户`);
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

export async function pickPublicContentOwner(tx: Prisma.TransactionClient) {
  const rows = await tx.publicContentUserPoolMember.findMany({
    where: { user: { status: "ACTIVE" } },
    select: { userId: true },
    orderBy: { userId: "asc" }
  });
  return pickPublicContentOwnerId(rows.map(item => item.userId));
}

export function publicInspirationRecipeWhere(status: "ACTIVE" | "BLOCKED" | "RECYCLED" | "DELETED" = "ACTIVE") {
  return {
    isInspiration: true,
    inspirationCategoryId: { not: null },
    status
  } satisfies Prisma.RecipeWhereInput;
}
