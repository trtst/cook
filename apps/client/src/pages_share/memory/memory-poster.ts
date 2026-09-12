import type { MealSlot } from "@/utils/meal-slot";

export const MEMORY_POSTER_TEMPLATE = {
  id: "memory-white-v2",
  brandLogoUrl: "https://static.trtst.com/O/logo.png",
  colors: {
    background: "#ffffff",
    surface: "#ffffff",
    text: "#1d1d1d",
    accent: "#d67a54",
    muted: "#747474",
    line: "#e8e8e8",
    orb: "rgba(214, 122, 84, 0.14)"
  },
  fonts: {
    title: "serif",
    body: "sans-serif"
  }
} as const;

export interface MemoryPosterSource {
  title: string;
  planDate: string | null;
  mealSlot: MealSlot | null;
  coverImageUrl: string | null;
  menuItems: Array<{ title: string; coverUrl: string | null }>;
  participants: Array<{
    displayName: string;
    avatarUrl: string | null;
    role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
  }>;
  caption: string | null;
  sharedAt: string | null;
  snapshotVersion: number | null;
}

export interface MemoryPosterDate {
  yearTop: string;
  yearBottom: string;
  text: string;
  weekday: string;
}

export interface MemoryPosterView extends MemoryPosterSource {
  date: MemoryPosterDate;
  showCover: boolean;
  showParticipants: boolean;
  showCaption: boolean;
  menuRows: string[][];
  participantRows: MemoryPosterSource["participants"][];
  captionLines: string[];
  footerY: number;
  height: number;
}

function textLines(value: string, maxCharacters: number) {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += maxCharacters) {
    lines.push(value.slice(index, index + maxCharacters));
  }
  return lines.length ? lines : [""];
}

function posterDate(value: string | null): MemoryPosterDate {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? null;
  if (!match) return { yearTop: "", yearBottom: "", text: "", weekday: "" };
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return { yearTop: "", yearBottom: "", text: "", weekday: "" };
  }
  return {
    yearTop: year.slice(0, 2),
    yearBottom: year.slice(2),
    text: `${month}.${day}`,
    weekday: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()]
  };
}

export function buildMemoryPosterView(source: MemoryPosterSource): MemoryPosterView {
  const menuRows: string[][] = [];
  for (let index = 0; index < source.menuItems.length; index += 2) {
    menuRows.push(source.menuItems.slice(index, index + 2).map(item => item.title));
  }
  const participantRows: MemoryPosterSource["participants"][] = [];
  for (let index = 0; index < source.participants.length; index += 4) {
    participantRows.push(source.participants.slice(index, index + 4));
  }
  const caption = source.caption?.trim() || null;
  const captionLines = caption ? textLines(caption, 22) : [];
  const showCover = Boolean(source.coverImageUrl);
  const showParticipants = source.participants.length > 0;
  const showCaption = Boolean(source.caption?.trim());
  let contentY = 300;
  if (showCover) contentY += 611;
  contentY += 37 + 68 + menuRows.length * 96;
  if (showParticipants) contentY += 20 + 62 + participantRows.length * 90;
  if (showCaption) contentY += 14 + 48 + Math.max(70, captionLines.length * 46);
  const footerY = contentY + 64;
  const height = footerY + 250;

  return {
    ...source,
    date: posterDate(source.planDate),
    caption,
    showCover,
    showParticipants,
    showCaption,
    menuRows,
    participantRows,
    captionLines,
    footerY,
    height
  };
}
