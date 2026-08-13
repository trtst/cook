import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";
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

export interface MemoryShareSnapshotResponse extends MemorySharePreviewResponse {
  id: UUID;
  diningEventId: UUID;
  sharePath: string;
}

export const memoryShareApi = {
  getPreview(shareToken: string) {
    return get<MemorySharePreviewResponse>(`${cfg.domain}/api/memory-shares/${encodeURIComponent(shareToken)}/preview`, undefined, {
      auth: false
    });
  },
  create(eventId: UUID, operationId: OperationId, showParticipants: boolean, caption: string | null) {
    return post<MemoryShareSnapshotResponse>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/memory-shares`,
      { showParticipants, caption },
      { idempotencyKey: operationId }
    );
  }
};
