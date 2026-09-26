export const SHOPPING_LIST_VOID_RETENTION_DAYS = 30;
export const SHOPPING_LIST_VOID_RETENTION_MS = SHOPPING_LIST_VOID_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function isShoppingListRetentionExpired(voidedAt: Date | null, now = new Date()) {
  return voidedAt !== null && voidedAt.getTime() + SHOPPING_LIST_VOID_RETENTION_MS <= now.getTime();
}
