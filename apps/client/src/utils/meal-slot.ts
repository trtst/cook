export type MealSlot = "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";

export interface MealSlotOption {
  value: MealSlot;
  label: string;
  kind: "core" | "extra";
}

export interface MealCalendarMark {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  hasExtra: boolean;
}

export const MEAL_SLOT_OPTIONS: MealSlotOption[] = [
  { value: "BREAKFAST", label: "早餐", kind: "core" },
  { value: "LUNCH", label: "午餐", kind: "core" },
  { value: "AFTERNOON_TEA", label: "下午茶", kind: "extra" },
  { value: "DINNER", label: "晚餐", kind: "core" },
  { value: "LATE_NIGHT", label: "夜宵", kind: "extra" }
];

export const CORE_MEAL_SLOTS: MealSlot[] = ["BREAKFAST", "LUNCH", "DINNER"];

export function formatMealSlot(slot: MealSlot | null | undefined) {
  if (!slot) return "";
  return MEAL_SLOT_OPTIONS.find(item => item.value === slot)?.label || "这顿饭";
}

export function mealSlotOrder(slot: MealSlot) {
  if (slot === "BREAKFAST") return 0;
  if (slot === "LUNCH") return 1;
  if (slot === "AFTERNOON_TEA") return 2;
  if (slot === "DINNER") return 3;
  return 4;
}

export function mealSlotDefaultTime(slot: MealSlot) {
  if (slot === "BREAKFAST") return "08:00";
  if (slot === "LUNCH") return "12:00";
  if (slot === "AFTERNOON_TEA") return "15:30";
  if (slot === "DINNER") return "18:30";
  return "21:30";
}

export function isCoreMealSlot(slot: MealSlot) {
  return slot === "BREAKFAST" || slot === "LUNCH" || slot === "DINNER";
}

export function createEmptyMealCalendarMark(): MealCalendarMark {
  return {
    breakfast: false,
    lunch: false,
    dinner: false,
    hasExtra: false
  };
}

export function appendMealSlotToMark(mark: MealCalendarMark, slot: MealSlot) {
  if (slot === "BREAKFAST") {
    mark.breakfast = true;
    return;
  }
  if (slot === "LUNCH") {
    mark.lunch = true;
    return;
  }
  if (slot === "DINNER") {
    mark.dinner = true;
    return;
  }
  mark.hasExtra = true;
}
