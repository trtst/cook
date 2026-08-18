import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";
import type { MealSlot } from "@/utils/meal-slot";

export interface SharePreviewResponse {
  title: string;
  planItemId: UUID | null;
  planDate: string | null;
  mealSlot: MealSlot | null;
  scheduledAt: IsoDateTime;
  coverImageUrl: string | null;
  organizerName: string | null;
  menuPreview: string[];
  countdownText: string | null;
  locationHint: string | null;
}

export interface MemoryShareParticipant {
  displayName: string;
  avatarUrl: string | null;
  role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
}

export interface MemoryShareMenuItem {
  title: string;
  coverUrl: string | null;
  cookName: string | null;
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

export interface ShareAcceptResponse {
  id: UUID;
  planItemId: UUID | null;
}

export const shareApi = {
  getPreview(shareToken: string) {
    return get<SharePreviewResponse>(`${cfg.domain}/api/share/${encodeURIComponent(shareToken)}/preview`, undefined, {
      auth: false
    });
  },
  acceptInvite(shareToken: string, operationId: OperationId, guestName: string) {
    return post<ShareAcceptResponse>(
      `${cfg.domain}/api/share/${encodeURIComponent(shareToken)}/accept`,
      { guestName },
      { idempotencyKey: operationId }
    );
  },
  getMemoryPreview(shareToken: string) {
    return get<MemorySharePreviewResponse>(`${cfg.domain}/api/memory-shares/${encodeURIComponent(shareToken)}/preview`, undefined, {
      auth: false
    });
  },
  createMemoryShare(eventId: UUID, operationId: OperationId, showParticipants: boolean, caption: string | null) {
    return post<MemoryShareSnapshotResponse>(
      `${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/memory-shares`,
      { showParticipants, caption },
      { idempotencyKey: operationId }
    );
  }
};
