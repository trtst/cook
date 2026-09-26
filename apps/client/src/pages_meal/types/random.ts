import type { UUID } from "@/apis/http";
import type {
  MealSlot,
  RandomMenuItem,
  RandomReplaceConstraint,
  RandomSlotPlan,
  RecipeSlotType
} from "../apis/random";

export type RandomPageStatus = "IDLE" | "CONFIG_READY" | "MENU_READY" | "MENU_MUTATING" | "COMPLETED";
export type RandomSlotStatus = "RECOMMENDED" | "LOCKED" | "REMOVED" | "REPLACING";

export interface RandomPageConditions {
  mealSlot: MealSlot | null;
  peopleCount: number | null;
  fridgePreferred: boolean;
}

export interface RandomSlotViewModel extends RandomMenuItem {
  status: RandomSlotStatus;
  requestSeq: number;
  latestAppliedSeq: number;
  replaceConstraints: RandomReplaceConstraint[];
}

export type RandomBoardSlot =
  | {
      kind: "RECIPE";
      slotId: string;
      slotType: RecipeSlotType;
      item: RandomSlotViewModel;
    }
  | {
      kind: "EMPTY";
      slotId: string;
      slotType: RecipeSlotType;
      item: null;
    };

export interface RandomPageState {
  pageStatus: RandomPageStatus;
  conditions: RandomPageConditions;
  slotPlan: RandomSlotPlan | null;
  slots: RandomSlotViewModel[];
}

export interface RandomPlanMenuItemInput {
  slotType: RecipeSlotType;
  sortOrder: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  purchaseState: "READY" | "PENDING";
}

export function createRandomSlotViewModel(item: RandomMenuItem): RandomSlotViewModel {
  return {
    ...item,
    status: "RECOMMENDED",
    requestSeq: 0,
    latestAppliedSeq: 0,
    replaceConstraints: []
  };
}

export function buildRandomBoardSlots(
  mealSlot: MealSlot,
  slotPlan: RandomSlotPlan,
  recipeSlots: RandomSlotViewModel[]
): RandomBoardSlot[] {
  const plannedSlots: Array<{ slotId: string; slotType: RecipeSlotType }> = [];
  const append = (slotType: RecipeSlotType, count: number) => {
    for (let index = 0; index < count; index += 1) {
      plannedSlots.push({ slotId: `${slotType}-${index + 1}`, slotType });
    }
  };

  if (mealSlot === "BREAKFAST") {
    append("BREAKFAST_STAPLE", slotPlan.breakfastStapleCount);
    append("BREAKFAST_PROTEIN", slotPlan.breakfastProteinCount);
    append("BREAKFAST_SIDE", slotPlan.breakfastSideCount);
  } else {
    append("MEAT", slotPlan.meatCount);
    append("VEGETABLE", slotPlan.vegetableCount);
    append("SOUP", slotPlan.soupCount);
    append("STAPLE", slotPlan.stapleCount);
  }

  const recipeSlotMap = new Map(recipeSlots.map(item => [item.slotId, item]));
  return plannedSlots.map(slot => {
    const item = recipeSlotMap.get(slot.slotId);
    return item
      ? { kind: "RECIPE", slotId: slot.slotId, slotType: slot.slotType, item }
      : { kind: "EMPTY", slotId: slot.slotId, slotType: slot.slotType, item: null };
  });
}
