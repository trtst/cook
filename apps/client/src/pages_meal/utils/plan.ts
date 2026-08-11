import type { MealPlanSummary } from "../apis/meal";
import { rpxToPx } from "./gesture";

export function movePlanRow(rows: MealPlanSummary[], fromIndex: number, toIndex: number) {
  const nextRows = [...rows];
  const [current] = nextRows.splice(fromIndex, 1);
  if (!current) return rows;
  nextRows.splice(toIndex, 0, current);
  return nextRows;
}

export function getPlanSortRowSpan(cardHeight: number, gapRpx: number, windowWidth?: number) {
  if (!cardHeight) return 0;
  return cardHeight + rpxToPx(gapRpx, windowWidth);
}
