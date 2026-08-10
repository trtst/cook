import { cfg } from "@/config";
import { get, type IsoDateTime, type UUID } from "@/apis/http";
import type { RecipeContentSnapshot } from "@/apis/recipe";

export interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  displayName: string | null;
  avatarUrl: string | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipeId: UUID | null;
  bringRecipeTitle: string | null;
}

export interface DiningEventSummary {
  id: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  organizerUid: number | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  menuItems: Array<{
    id: UUID;
    recipeId: UUID | null;
    recipeVersionId: UUID;
    title: string;
    cookUserUid: number | null;
    cookName: string | null;
    version: number;
  }>;
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
}

export const mealApi = {
  getDiningEvent(eventId: UUID) {
    return get<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}`);
  }
};
