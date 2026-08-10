function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeSecond(value: string | null, emptyText = "") {
  if (!value) return emptyText;
  const trimmed = value.trim();
  if (!trimmed) return emptyText;
  const normalized = trimmed.replace("T", " ").replace(/\.\d+Z?$/, "").replace(/Z$/, "").trim();
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  const date = parseDate(trimmed);
  if (!date) {
    return normalized.slice(0, 19);
  }
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
