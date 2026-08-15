import type { UUID } from "@/apis/http";

export interface ShoppingCompleteEntry {
  itemId: UUID;
  name: string;
  quantityText: string;
  store: boolean;
  expireDays: number | null;
  expireAt: string | null;
}

type CompleteSourceItem = {
  id: UUID;
  name: string;
  quantityText: string | null;
  remainingQuantityText: string | null;
  status: "OPEN" | "CHECKED" | "REMOVED";
};

export function toShoppingCompleteEntries(items: CompleteSourceItem[]): ShoppingCompleteEntry[] {
  return items
    .filter(item => item.status === "CHECKED")
    .map(item => ({
      itemId: item.id,
      name: item.name,
      quantityText: item.remainingQuantityText || item.quantityText || "",
      store: true,
      expireDays: 7,
      expireAt: null
    }));
}
