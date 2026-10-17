import type { HomeTopicWeekday } from "../../contracts/types";

const dayCodes: HomeTopicWeekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const beijingOffsetMs = 8 * 60 * 60 * 1000;

export function nextBeijingWeekStart(value: Date) {
  const beijing = new Date(value.getTime() + beijingOffsetMs);
  const weekday = beijing.getUTCDay();
  const daysUntilNextSunday = weekday === 0 ? 7 : 7 - weekday;
  return new Date(Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate() + daysUntilNextSunday));
}

export function beijingWeekEnd(start: Date) {
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
}

export function weekdayIndex(weekday: HomeTopicWeekday) {
  return dayCodes.indexOf(weekday);
}

export function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
