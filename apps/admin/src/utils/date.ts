function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateParts(value: string) {
  const date = parseDate(value);
  if (!date) return null;

  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return { year, month, day, hour, minute, second };
}

export function formatDateDay(value?: string | null, emptyText = "-") {
  if (!value) return emptyText;
  const parts = dateParts(value);
  if (!parts) return value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateTimeMinute(value?: string | null, emptyText = "-") {
  if (!value) return emptyText;
  const parts = dateParts(value);
  if (!parts) return value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatDateTime(value?: string | null, emptyText = "-") {
  if (!value) return emptyText;
  const parts = dateParts(value);
  if (!parts) return value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
