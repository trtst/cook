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

export function resolveMedalImageUrl(
  item: Pick<UserMedalSummary, "earned" | "earnedImageUrl" | "lockedImageUrl" | "imageUrl">
) {
  if (item.earned) {
    return item.earnedImageUrl || item.lockedImageUrl || item.imageUrl || null;
  }
  return item.lockedImageUrl || item.earnedImageUrl || item.imageUrl || null;
}

export function formatMedalState(item: Pick<UserMedalSummary, "earned" | "isLimited">) {
  if (item.earned) {
    return item.isLimited ? "限定已点亮" : "已点亮";
  }
  return item.isLimited ? "限定待解锁" : "待点亮";
}

export function formatMedalStateHint(
  item: Pick<UserMedalSummary, "earned" | "awardedAt" | "isLimited" | "startAt" | "endAt">
) {
  if (item.earned) {
    return `获得于 ${formatMedalDate(item.awardedAt)}`;
  }
  if (item.isLimited) {
    return formatMedalRange(item);
  }
  return "达成条件后自动点亮";
}
