import { createHash } from "node:crypto";

export function normalizeCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function hashCode(code: string) {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

export function maskCode(code: string) {
  const normalized = normalizeCode(code);
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
}
