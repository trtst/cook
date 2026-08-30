import { cfg } from "@/config";
import { get, type IsoDateTime, type UUID } from "./http";

export type HomeEntryPlacement = "MAIN" | "SIDE_TOP" | "SIDE_BOTTOM" | "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";
export type HomeEntryTargetType = "PAGE" | "WEB_VIEW";
export type HomeEntryStatus = "LISTED" | "UNLISTED";

export interface HomeEntryItem {
  id: string;
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
}

export interface HomeEntriesResponse {
  items: HomeEntryItem[];
}

export type HomeRecentArrangementStatus =
  | "EMPTY_MENU"
  | "PENDING_CONFIRM"
  | "PENDING_SHOPPING"
  | "READY_TO_COOK"
  | "TIME_UP_SHARE";

export interface HomeRecentArrangement {
  sourceType: "PLAN" | "EVENT";
  planItemId: UUID;
  planDate: string;
  eventId: UUID | null;
  title: string;
  scheduledAt: IsoDateTime | null;
  participantCount: number;
  menuCount: number;
  gapCount: number | null;
  status: HomeRecentArrangementStatus;
}

export type HomeNextMealStatus =
  | "NO_ARRANGEMENT"
  | "NEED_GAP_CHECK"
  | "NEED_SHOPPING"
  | "READY_TO_COOK"
  | "COMPLETED";

export interface HomeNextMealState {
  status: HomeNextMealStatus;
  arrangement: HomeRecentArrangement | null;
}

export type HomeWeekOverviewStatus =
  | "NO_ARRANGEMENT"
  | "EMPTY_MENU"
  | "PENDING_CONFIRM"
  | "PENDING_SHOPPING"
  | "READY_TO_COOK"
  | "COMPLETED";

export type HomeWeekDayStatus = "EMPTY" | "PLANNED" | "PENDING_CONFIRM" | "PENDING_SHOPPING" | "READY_TO_COOK" | "COMPLETED";

export interface HomeWeekOverviewDay {
  date: string;
  label: string;
  status: HomeWeekDayStatus;
}

export interface HomeWeekOverview {
  status: HomeWeekOverviewStatus;
  title: string;
  summary: string;
  actionText: string;
  targetType: "PAGE";
  targetValue: string;
  notificationTime: IsoDateTime | "";
  plannedDayCount: number;
  totalDayCount: number;
  activeListCount: number;
  expiringCount: number;
  arrangement: HomeRecentArrangement | null;
  days: HomeWeekOverviewDay[];
}

export type HomeFridgeRecipeKind = "MY" | "INSPIRATION";
export type HomeFridgeRecipeFit = "HIGH" | "MEDIUM" | "LOW";

export interface HomeFridgeRecipeItem {
  recipeId: UUID;
  title: string;
  coverImageUrl: string | null;
  kind: HomeFridgeRecipeKind;
  ownedRecipeId: UUID | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
  difficultyText: string | null;
  durationText: string | null;
  matchedIngredientCount: number;
  missingIngredientCount: number;
  totalIngredientCount: number;
  fridgeFit: HomeFridgeRecipeFit;
}

export interface HomeFridgeRecipesResponse {
  items: HomeFridgeRecipeItem[];
}

export type HomeTopicType =
  | "WEEKEND_GATHERING"
  | "QUICK_AFTER_WORK"
  | "HOME_STYLE"
  | "ONE_PERSON"
  | "BREAKFAST"
  | "LIGHT_DINNER";

export interface HomeTopicRecipeItem {
  id: number;
  sourceVersionId: number;
  sort: number;
  title: string;
  coverImageUrl: string | null;
  ownedRecipeId: number | null;
  recommendNote: string | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
  difficultyText: string | null;
  durationText: string | null;
  category: {
    id: number;
    name: string;
    iconKey: string | null;
  };
  likeCount: number;
  collectCount: number;
  updatedAt: string;
}

export interface HomeTopicHistoryItem {
  id: number;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: string;
  updatedAt: string;
}

export interface HomeTopicDetail {
  id: number;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: string;
  updatedAt: string;
  items: HomeTopicRecipeItem[];
  history: HomeTopicHistoryItem[];
}

export interface HomeTopicCurrentResponse {
  topic: HomeTopicDetail | null;
}

export interface HomeTopicDetailResponse {
  topic: HomeTopicDetail;
}

export const homeApi = {
  getHomeEntries() {
    return get<HomeEntriesResponse>(`${cfg.domain}/api/home-entries`, undefined, { auth: false });
  },
  getRecentArrangement() {
    return get<HomeRecentArrangement | null>(`${cfg.domain}/api/home/recent-arrangement`);
  },
  getNextMealState() {
    return get<HomeNextMealState>(`${cfg.domain}/api/home/next-meal`);
  },
  getWeekOverview() {
    return get<HomeWeekOverview>(`${cfg.domain}/api/home/week-overview`);
  },
  getFridgeRecipes() {
    return get<HomeFridgeRecipesResponse>(`${cfg.domain}/api/home/fridge-recipes`);
  },
  getCurrentTopic() {
    return get<HomeTopicCurrentResponse>(`${cfg.domain}/api/home-topics/current`);
  },
  getTopic(topicId: number) {
    return get<HomeTopicDetailResponse>(`${cfg.domain}/api/home-topics/${encodeURIComponent(String(topicId))}`);
  }
};
