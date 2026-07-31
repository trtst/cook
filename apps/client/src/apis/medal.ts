import { cfg } from "@/config";
import { get, type IsoDateTime } from "./http";

export type MedalAwardRule =
  | "MEAL_COMPLETION"
  | "DINING_EVENT_COMPLETION"
  | "GROUP_MEAL_COMPLETION"
  | "FULL_LOOP_COMPLETION"
  | "RECOMMENDATION_ADOPTED_TOTAL";

export type MedalCategory =
  | "MEAL_CHECKIN"
  | "DINING_COLLABORATION"
  | "RECOMMENDATION_CONTRIBUTION"
  | "HOLIDAY_LIMITED";

export interface MedalCategorySummary {
  key: MedalCategory;
  name: string;
  totalCount: number;
  earnedCount: number;
}

export interface UserMedalSummary {
  code: string;
  awardRule: MedalAwardRule;
  iconKey: string;
  category: MedalCategory;
  categoryName: string;
  name: string;
  description: string;
  condition: string;
  earned: boolean;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
  awardedAt: IsoDateTime | null;
}

export interface MedalWallResponse {
  earnedCount: number;
  totalCount: number;
  categories: MedalCategorySummary[];
  items: UserMedalSummary[];
}

export const medalApi = {
  getCurrent() {
    return get<MedalWallResponse>(`${cfg.domain}/api/users/me/medals`);
  }
};
