import type { UUID } from "@/apis/http";

export function isUuid(value: UUID | null): value is UUID {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

export function dedupeIds(ids: UUID[]) {
  return Array.from(new Set(ids.filter(isUuid)));
}
