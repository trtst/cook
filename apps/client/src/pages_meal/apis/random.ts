import { cfg } from "@/config";
import { post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";
import type { RecipeDuration } from "@/apis/recipe";
import type { ShoppingItemSummary } from "@/pages_pantry/apis/shopping";

export type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER";
export type RecipeSlotType =
  | "MEAT"
  | "VEGETABLE"
  | "SOUP"
  | "STAPLE"
  | "BREAKFAST_STAPLE"
  | "BREAKFAST_PROTEIN"
  | "BREAKFAST_SIDE";
export type RecipeProteinType = "PORK" | "CHICKEN" | "BEEF" | "LAMB" | "DUCK" | "FISH" | "NONE";
export type RandomReplaceConstraintKind = "FLAVOR" | "DURATION" | "INGREDIENT" | "AVOID_INGREDIENT";
export type RandomMenuWarningCode = "INSUFFICIENT_CANDIDATES" | "PARTIAL_MENU";
export type RandomGapStatus = "OK" | "PARTIAL" | "MISSING" | "UNKNOWN";
export type RandomGapInventoryStatus = "ENOUGH" | "PARTIAL" | "MISSING" | "UNKNOWN";
export type RandomGapDecision = "HAS" | "MISSING";
export type RandomFridgeFit = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface RandomSlotPlan {
  meatCount: number;
  vegetableCount: number;
  soupCount: number;
  stapleCount: number;
  breakfastStapleCount: number;
  breakfastProteinCount: number;
  breakfastSideCount: number;
}

export interface RandomMenuWarning {
  code: RandomMenuWarningCode;
  message: string;
  slotTypes: RecipeSlotType[];
}

export interface RandomMenuItem {
  slotId: string;
  slotType: RecipeSlotType;
  slotIndex: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  title: string;
  coverUrl: string | null;
  servings: number | null;
  duration: RecipeDuration | null;
  durationText: string | null;
  estimatedCalories: number | null;
  flavorTags: string[];
  mainProteinType: RecipeProteinType | null;
  fridgeFit: RandomFridgeFit;
}

export interface RandomMenuResponse {
  mealSlot: MealSlot;
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan;
  items: RandomMenuItem[];
  warnings: RandomMenuWarning[];
  generatedAt: IsoDateTime;
}

export interface GenerateRandomMenuRequest {
  mealSlot: MealSlot;
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan?: RandomSlotPlan | null;
}

export interface ReplaceRandomMenuCurrentItem {
  slotId: string;
  slotType: RecipeSlotType;
  recipeId: UUID;
  recipeVersionId: UUID;
}

export interface RandomReplaceConstraint {
  kind: RandomReplaceConstraintKind;
  value?: string | null;
  ingredientId?: UUID | null;
  ingredientName?: string | null;
}

export interface ReplaceRandomMenuSlotRequest {
  mealSlot: MealSlot;
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan;
  currentItems: ReplaceRandomMenuCurrentItem[];
  targetSlotId: string;
  targetSlotType: RecipeSlotType;
  replaceConstraints: RandomReplaceConstraint[];
  rejectedRecipeVersionIds: UUID[];
  requestSeq: number;
}

export interface ReplaceRandomMenuSlotResponse {
  requestSeq: number;
  slot: RandomMenuItem | null;
  warning: RandomMenuWarning | null;
}

export interface RandomGapInventoryDecisionItem {
  slotId: string;
  ingredientId?: UUID | null;
  ingredientName: string;
  decision: RandomGapDecision;
}

export interface RandomGapCheckItem {
  slotId: string;
  slotType: RecipeSlotType;
  recipeId: UUID;
  recipeVersionId: UUID;
}

export interface CheckRandomMenuGapRequest {
  mealSlot: MealSlot;
  peopleCount: number;
  items: RandomGapCheckItem[];
  inventoryDecisions: RandomGapInventoryDecisionItem[];
}

export interface RandomGapIngredient {
  decisionKey: string;
  ingredientId: UUID | null;
  ingredientName: string;
  quantityText: string | null;
  inventoryStatus: RandomGapInventoryStatus;
  purchasable: boolean;
}

export interface RandomGapItem {
  slotId: string;
  slotType: RecipeSlotType;
  recipeId: UUID;
  recipeVersionId: UUID;
  recipeName: string;
  status: RandomGapStatus;
  missingIngredients: RandomGapIngredient[];
  actions: {
    canKeep: boolean;
    canReplace: boolean;
    canRemove: boolean;
    canAddToShopping: boolean;
  };
  unresolvedUnknownCount: number;
}

export interface RandomGapSummary {
  okCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
}

export interface CheckRandomMenuGapResponse {
  items: RandomGapItem[];
  summary: RandomGapSummary;
  canCreatePlan: boolean;
}

export interface CreateRandomMenuShoppingItemsRequest {
  operationId: OperationId;
  items: Array<{
    slotId: string;
    recipeId: UUID;
    recipeVersionId: UUID;
    ingredients: Array<{
      ingredientId?: UUID | null;
      ingredientName: string;
      quantityText: string | null;
    }>;
  }>;
}

export const randomMealApi = {
  generateMenu(body: GenerateRandomMenuRequest) {
    return post<RandomMenuResponse>(`${cfg.domain}/api/random-menus/generate`, body);
  },
  replaceSlot(body: ReplaceRandomMenuSlotRequest) {
    return post<ReplaceRandomMenuSlotResponse>(`${cfg.domain}/api/random-menu-slots/replace`, body);
  },
  previewGap(body: CheckRandomMenuGapRequest) {
    return post<CheckRandomMenuGapResponse>(`${cfg.domain}/api/random-menu-gap/preview`, body);
  },
  createShoppingItems(body: CreateRandomMenuShoppingItemsRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingItemSummary[]>(`${cfg.domain}/api/shopping-items/from-random-menu`, payload, {
      idempotencyKey: operationId
    });
  }
};
