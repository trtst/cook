function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateOnly(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(value: Date, offset: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + offset);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate(), 12, 0, 0, 0);
}

export function addMonths(value: Date, offset: number) {
  const year = value.getFullYear();
  const month = value.getMonth() + offset;
  const day = value.getDate();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(day, lastDay), 12, 0, 0, 0);
}

export function startOfWeek(value: Date) {
  return addDays(value, -value.getDay());
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
