import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot } from "@/apis/recipe";

export interface SharePreviewResponse {
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  menu: Pick<RecipeContentSnapshot, "name" | "ingredients">;
  organizerUid: number;
}

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
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | null;
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
  participants: Array<{
    id: UUID;
  }>;
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
