import type { UUID } from "@/apis/http";
import type {
  CheckRandomMenuGapResponse,
  MealSlot,
  RandomGapDecision,
  RandomGapInventoryDecisionItem,
  RandomGapInventoryStatus,
  RandomGapItem,
  RandomGapSummary,
  RandomMenuItem,
  RandomReplaceConstraint,
  RandomSlotPlan,
  RecipeSlotType
} from "../apis/random";

export type RandomPageStatus = "IDLE" | "CONFIG_READY" | "MENU_READY" | "MENU_MUTATING" | "GAP_CHECKING" | "COMPLETED";
export type RandomSlotStatus = "RECOMMENDED" | "LOCKED" | "REMOVED" | "REPLACING";
export type RandomGapAction = "KEEP" | "REMOVE" | "REPLACE" | "BUY" | "KEEP_PENDING" | null;

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
  gapAction: RandomGapAction;
}

export interface RandomGapDecisionViewModel {
  decisionKey: string;
  slotId: string;
  ingredientId: UUID | null;
  ingredientName: string;
  inventoryStatus: RandomGapInventoryStatus;
  decision: RandomGapDecision | null;
  quantityText: string | null;
  purchasable: boolean;
}

export interface RandomGapItemViewModel extends RandomGapItem {
  action: RandomGapAction;
  decisions: RandomGapDecisionViewModel[];
}

export interface RandomGapState {
  visible: boolean;
  loading: boolean;
  items: RandomGapItemViewModel[];
  summary: RandomGapSummary | null;
  canCreatePlan: boolean;
}

export interface RandomPageState {
  pageStatus: RandomPageStatus;
  conditions: RandomPageConditions;
  slotPlan: RandomSlotPlan | null;
  slots: RandomSlotViewModel[];
  gap: RandomGapState;
}

export interface RandomPlanMenuItemInput {
  slotType: RecipeSlotType;
  sortOrder: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  purchaseState: "READY" | "PENDING";
}

export function toGapDecisionItems(items: RandomGapItemViewModel[]): RandomGapInventoryDecisionItem[] {
  return items.flatMap(item =>
    item.decisions
      .filter(decision => decision.decision !== null)
      .map(decision => ({
        slotId: item.slotId,
        ingredientId: decision.ingredientId,
        ingredientName: decision.ingredientName,
        decision: decision.decision as RandomGapDecision
      }))
  );
}

export function createEmptyGapState(): RandomGapState {
  return {
    visible: false,
    loading: false,
    items: [],
    summary: null,
    canCreatePlan: false
  };
}

export function createRandomSlotViewModel(item: RandomMenuItem): RandomSlotViewModel {
  return {
    ...item,
    status: "RECOMMENDED",
    requestSeq: 0,
    latestAppliedSeq: 0,
    replaceConstraints: [],
    gapAction: null
  };
}

export function createGapItemViewModel(item: RandomGapItem): RandomGapItemViewModel {
  return {
    ...item,
    action: null,
    decisions: item.missingIngredients.map(ingredient => ({
      decisionKey: ingredient.decisionKey,
      slotId: item.slotId,
      ingredientId: ingredient.ingredientId,
      ingredientName: ingredient.ingredientName,
      inventoryStatus: ingredient.inventoryStatus,
      decision: null,
      quantityText: ingredient.quantityText,
      purchasable: ingredient.purchasable
    }))
  };
}

export function buildGapState(response: CheckRandomMenuGapResponse): RandomGapState {
  return {
    visible: true,
    loading: false,
    items: response.items.map(createGapItemViewModel),
    summary: response.summary,
    canCreatePlan: response.canCreatePlan
  };
}
