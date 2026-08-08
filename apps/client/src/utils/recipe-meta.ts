import type { RecipeDifficulty, RecipeDuration } from "@/apis/recipe";

export const difficultyOptions = [
  { value: "BEGINNER" as const, label: "新手友好" },
  { value: "EASY" as const, label: "轻松上手" },
  { value: "SKILLED" as const, label: "需要经验" },
  { value: "CHALLENGING" as const, label: "进阶挑战" }
];

export const durationOptions = [
  { value: "WITHIN_15" as const, label: "15分钟内" },
  { value: "BETWEEN_15_30" as const, label: "15~30分钟" },
  { value: "BETWEEN_30_60" as const, label: "30~60分钟" },
  { value: "OVER_60" as const, label: "1小时以上" }
];

const difficultyMap = Object.fromEntries(difficultyOptions.map(item => [item.value, item.label])) as Record<RecipeDifficulty, string>;
const durationMap = Object.fromEntries(durationOptions.map(item => [item.value, item.label])) as Record<RecipeDuration, string>;

export function difficultyText(value: RecipeDifficulty | null, emptyText = "") {
  return value ? difficultyMap[value] : emptyText;
}

export function durationText(value: RecipeDuration | null, emptyText = "") {
  return value ? durationMap[value] : emptyText;
}
