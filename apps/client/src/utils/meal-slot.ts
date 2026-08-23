export type MealSlot = "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";

export interface MealSlotOption {
  value: MealSlot;
  label: string;
  kind: "core" | "extra";
}

export interface MealCalendarMark {
  breakfast: boolean;
  lunch: boolean;
  afternoonTea: boolean;
  dinner: boolean;
  lateNight: boolean;
}

export type MealSlotTone = "breakfast" | "lunch" | "afternoon-tea" | "dinner" | "late-night";

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

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatClock(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function roundUpToNextHalfHour(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  if (minutes === 0 || minutes === 30) {
    next.setMinutes(minutes + 30);
    return next;
  }
  next.setMinutes(minutes < 30 ? 30 : 60);
  return next;
}

export function resolveMealSlotSuggestedTime(slot: MealSlot, dateText: string, now = new Date()) {
  const defaultTime = mealSlotDefaultTime(slot);
  if (formatLocalDate(now) !== dateText) return defaultTime;
  const suggested = new Date(`${dateText}T${defaultTime}:00`);
  if (!Number.isFinite(suggested.getTime())) return defaultTime;
  if (suggested.getTime() > now.getTime()) return defaultTime;
  return formatClock(roundUpToNextHalfHour(now));
}

export function isPastLocalDateTime(dateText: string, timeText: string, now = new Date()) {
  const value = new Date(`${dateText}T${timeText}:00`);
  if (!Number.isFinite(value.getTime())) return false;
  return value.getTime() < now.getTime();
}

export function resolvePlanEndOfDayMs(dateText: string | null | undefined) {
  if (!dateText) return 0;
  const value = new Date(`${dateText}T23:59:59.999`);
  const time = value.getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isCoreMealSlot(slot: MealSlot) {
  return slot === "BREAKFAST" || slot === "LUNCH" || slot === "DINNER";
}

export function createEmptyMealCalendarMark(): MealCalendarMark {
  return {
    breakfast: false,
    lunch: false,
    afternoonTea: false,
    dinner: false,
    lateNight: false
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
  if (slot === "AFTERNOON_TEA") {
    mark.afternoonTea = true;
    return;
  }
  if (slot === "DINNER") {
    mark.dinner = true;
    return;
  }
  mark.lateNight = true;
}

export function resolveMealSlotTone(slot: MealSlot | null | undefined): MealSlotTone {
  if (slot === "BREAKFAST") return "breakfast";
  if (slot === "LUNCH") return "lunch";
  if (slot === "AFTERNOON_TEA") return "afternoon-tea";
  if (slot === "DINNER") return "dinner";
  return "late-night";
}

export function buildMealSlotTitle(slot: MealSlot | null | undefined) {
  const label = formatMealSlot(slot);
  return label ? `${label}饮食计划` : "这顿饮食计划";
}
