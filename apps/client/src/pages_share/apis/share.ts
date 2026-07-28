import { cfg } from "@/config";
import { get, post, type IsoDateTime, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot } from "@/apis/recipe";

export interface SharePreviewResponse {
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  menu: Pick<RecipeContentSnapshot, "name" | "ingredients">;
  organizerUid: number;
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
  acceptInvite(shareToken: string, operationId: UUID, guestName: string) {
    return post<ShareAcceptResponse>(`${cfg.domain}/api/share/${encodeURIComponent(shareToken)}/accept`, {
      operationId,
      guestName
    });
  }
};
