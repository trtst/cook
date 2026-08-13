import { mealApi, type MealPlanSummary } from "@/apis/meal";
import { addDays, formatDateOnly } from "../utils/date";

export { mealApi };
export type {
  ClaimCookRequest,
  CreateDiningEventRequest,
  CreateMealPlanRequest,
  DiningEventParticipantSummary,
  DiningEventSummary,
  MealPlanMenuItemSummary,
  MealPlanQuery,
  MealPlanSummary
} from "@/apis/meal";

export function listWeekPlans(weekStart: Date) {
  const from = formatDateOnly(weekStart);
  const to = formatDateOnly(addDays(weekStart, 6));
  return mealApi.listPlans({ from, to });
}
