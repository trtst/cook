import type { AdminRecipeContentInput } from "@/apis/recipe";

type Difficulty = AdminRecipeContentInput["difficulty"];
type Duration = AdminRecipeContentInput["duration"];

export const difficultyOptions = [
  { label: "新手友好", value: "BEGINNER" as const },
  { label: "轻松上手", value: "EASY" as const },
  { label: "需要经验", value: "SKILLED" as const },
  { label: "进阶挑战", value: "CHALLENGING" as const }
];

export const durationOptions = [
  { label: "15 分钟内", value: "WITHIN_15" as const },
  { label: "15~30 分钟", value: "BETWEEN_15_30" as const },
  { label: "30~60 分钟", value: "BETWEEN_30_60" as const },
  { label: "1 小时以上", value: "OVER_60" as const }
];

export const difficultyLabelMap = Object.fromEntries(
  difficultyOptions.map(item => [item.value, item.label])
) as Record<Difficulty, string>;

export const durationLabelMap = Object.fromEntries(
  durationOptions.map(item => [item.value, item.label])
) as Record<Duration, string>;

export function difficultyText(value: Difficulty | null, emptyText = "-") {
  return value ? difficultyLabelMap[value] : emptyText;
}

export function durationText(value: Duration | null, emptyText = "-") {
  return value ? durationLabelMap[value] : emptyText;
}
