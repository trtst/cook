import { cfg } from "@/config";
import { get, type IsoDateTime, type UUID } from "@/apis/http";

export type ShoppingGapWindow = "NEXT_48_HOURS" | "NEXT_7_DAYS" | "LATER";

export interface ShoppingGapEventSummary {
  eventId: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  recipeTitles: string[];
}

export interface ShoppingGapItem {
  key: string;
  ingredientId: UUID | null;
  name: string;
  quantityText: string | null;
  sourceCount: number;
  eventCount: number;
  events: ShoppingGapEventSummary[];
}

export interface ShoppingGapSection {
  window: ShoppingGapWindow;
  title: string;
  description: string;
  itemCount: number;
  eventCount: number;
  items: ShoppingGapItem[];
}

export interface ShoppingGapResponse {
  sections: ShoppingGapSection[];
  totalItemCount: number;
  totalEventCount: number;
  hasLater: boolean;
  laterItemCount: number;
}

export const shoppingApi = {
  previewGap() {
    return get<ShoppingGapResponse>(`${cfg.domain}/api/shopping-gap`);
  }
};
