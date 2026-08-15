import { addDays, addMonths, formatDateOnly, parseDateOnly, startOfWeek } from "@/utils/date";

export { addDays, addMonths, formatDateOnly, parseDateOnly, startOfWeek };

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildWeekRangeStart(centerWeekStart: Date, panelMid: number) {
  return addDays(centerWeekStart, -panelMid * 7);
}

export function buildMonthTransitionPanels(currentWeekStart: Date, targetWeekStart: Date, offset: -1 | 1) {
  if (offset < 0) {
    return [
      addDays(targetWeekStart, -7),
      targetWeekStart,
      currentWeekStart,
      addDays(currentWeekStart, 7),
      addDays(currentWeekStart, 14)
    ];
  }
  return [
    addDays(currentWeekStart, -14),
    addDays(currentWeekStart, -7),
    currentWeekStart,
    targetWeekStart,
    addDays(targetWeekStart, 7)
  ];
}

export function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTimeMinute(value: string | null, emptyText = "") {
  if (!value) return emptyText;
  const date = parseDate(value);
  if (!date) return value;
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function formatMonthDayMinute(value: string | null, emptyText = "") {
  if (!value) return emptyText;
  const date = parseDate(value);
  if (!date) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

export function formatHourMinute(value: string | null, emptyText = "") {
  if (!value) return emptyText;
  const date = parseDate(value);
  if (!date) return value;
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${hour}:${minute}`;
}
