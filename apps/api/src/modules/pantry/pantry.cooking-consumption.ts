import {
  mergeRecipeConsumptionLines,
  type MergedRecipeConsumptionLine,
  type RecipeConsumptionLine
} from "./pantry.low-friction-model";
import { Prisma } from "@prisma/client";

export type CookingConsumptionLine = RecipeConsumptionLine;

export interface CookingConsumptionPlan {
  exactLines: MergedRecipeConsumptionLine[];
  skippedFuzzySources: string[];
}

export function scaleCookingQuantity(quantity: Prisma.Decimal | number | string, baseServings: number, servings: number) {
  if (!Number.isInteger(baseServings) || baseServings <= 0 || !Number.isInteger(servings) || servings <= 0) {
    throw new RangeError("菜谱人数必须是正整数");
  }
  return new Prisma.Decimal(quantity).mul(servings).div(baseServings).toString();
}

export function buildCookingConsumptionPlan(lines: CookingConsumptionLine[]): CookingConsumptionPlan {
  return mergeRecipeConsumptionLines(lines);
}
