import { cfg } from "@/config";
import { get } from "./http";

export type HomeEntryPlacement = "MAIN" | "SIDE_TOP" | "SIDE_BOTTOM" | "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";
export type HomeEntryTargetType = "PAGE" | "WEB_VIEW";

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

export type HomeTopicType =
  | "WEEKEND_GATHERING"
  | "QUICK_AFTER_WORK"
  | "HOME_STYLE"
  | "ONE_PERSON"
  | "BREAKFAST"
  | "LIGHT_DINNER";

export interface HomeTopicRecipeItem {
  id: number;
  sort: number;
  title: string;
  coverImageUrl: string | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
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
  getCurrentTopic() {
    return get<HomeTopicCurrentResponse>(`${cfg.domain}/api/home-topics/current`, undefined, { auth: false });
  },
  getTopic(topicId: number) {
    return get<HomeTopicDetailResponse>(`${cfg.domain}/api/home-topics/${encodeURIComponent(String(topicId))}`, undefined, {
      auth: false
    });
  }
};
