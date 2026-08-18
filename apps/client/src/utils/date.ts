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

export function todayText() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeMinute(value: string | null, emptyText = "") {
  if (!value) return emptyText;
  const date = parseDateTime(value);
  if (!date) return value;
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
