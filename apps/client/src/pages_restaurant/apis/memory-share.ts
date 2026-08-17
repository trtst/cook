import { cfg } from "@/config";
import { get, type IsoDateTime, type UUID } from "@/apis/http";
import type { MealSlot } from "@/utils/meal-slot";

export interface MemoryShareMenuItem {
  title: string;
  coverUrl: string | null;
  cookName: string | null;
}

export interface MemoryShareParticipant {
  displayName: string;
  avatarUrl: string | null;
  role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
}

export interface MemorySharePreviewResponse {
  title: string;
  planDate: string | null;
  mealSlot: MealSlot | null;
  menuItems: MemoryShareMenuItem[];
  participants: MemoryShareParticipant[];
  caption: string | null;
  sharedAt: IsoDateTime;
  snapshotVersion: number;
}

export const memoryShareApi = {
  getPreview(shareToken: string) {
    return get<MemorySharePreviewResponse>(`${cfg.domain}/api/memory-shares/${encodeURIComponent(shareToken)}/preview`, undefined, {
      auth: false
    });
  }
};
