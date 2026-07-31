import type { UserMedalSummary } from "@/apis/medal";

const medalIconClassMap: Record<string, string> = {
  PLAN: "icon-plan",
  DINING_EVENT: "icon-dining-event",
  GROUP: "icon-dining-event",
  SHOPPING: "icon-shopping",
  RECOMMEND: "icon-recommend"
};

export function getMedalIconClass(iconKey: string) {
  return medalIconClassMap[iconKey] ?? "icon-notice";
}

export function formatMedalDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, 16);
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function formatMedalRange(item: Pick<UserMedalSummary, "startAt" | "endAt">) {
  if (!item.startAt && !item.endAt) return "长期开放";
  return `${formatMedalDate(item.startAt)} - ${formatMedalDate(item.endAt)}`;
}
