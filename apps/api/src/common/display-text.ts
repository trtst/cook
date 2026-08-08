import type { HomeTopicType, HomeTopicTypeOption, RecipeDifficulty, RecipeDuration } from "../contracts/types";

export const topicTypeOptions: HomeTopicTypeOption[] = [
  { label: "周末聚餐", value: "WEEKEND_GATHERING" },
  { label: "下班快做", value: "QUICK_AFTER_WORK" },
  { label: "家常下饭", value: "HOME_STYLE" },
  { label: "一人食", value: "ONE_PERSON" },
  { label: "早餐灵感", value: "BREAKFAST" },
  { label: "轻松一餐", value: "LIGHT_DINNER" }
];

export function topicTypeText(value: HomeTopicType) {
  return topicTypeOptions.find(item => item.value === value)?.label ?? "轻松一餐";
}

export function recipeDifficultyText(value: RecipeDifficulty | null) {
  if (value === "BEGINNER") return "新手友好";
  if (value === "EASY") return "轻松上手";
  if (value === "SKILLED") return "需要经验";
  if (value === "CHALLENGING") return "进阶挑战";
  return null;
}

export function recipeDurationText(value: RecipeDuration | null) {
  if (value === "WITHIN_15") return "15分钟内";
  if (value === "BETWEEN_15_30") return "15~30分钟";
  if (value === "BETWEEN_30_60") return "30~60分钟";
  if (value === "OVER_60") return "1小时以上";
  return null;
}
