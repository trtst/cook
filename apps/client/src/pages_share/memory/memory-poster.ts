import type { MealSlot } from "@/utils/meal-slot";

export const MEMORY_POSTER_TEMPLATE = {
  id: "warm-memory-v1",
  brandLogoUrl: "https://static.trtst.com/O/logo.png",
  colors: {
    background: "#fbf4e5",
    surface: "#fffaf0",
    text: "#2d2418",
    accent: "#d67a54",
    muted: "#8c7c68",
    line: "#dfd2bd"
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
  metaText: string;
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

export interface MemoryPosterView extends MemoryPosterSource {
  showCover: boolean;
  showParticipants: boolean;
  showCaption: boolean;
  menuRows: string[][];
  participantRows: MemoryPosterSource["participants"][];
  captionLines: string[];
  height: number;
}

function textLines(value: string, maxCharacters: number) {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += maxCharacters) {
    lines.push(value.slice(index, index + maxCharacters));
  }
  return lines.length ? lines : [""];
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
  const extraMenuRows = Math.max(0, menuRows.length - 1);
  const height =
    1030 +
    extraMenuRows * 96 +
    (showCover ? 600 : 0) +
    (showParticipants ? 130 + Math.max(0, participantRows.length - 1) * 90 : 0) +
    (showCaption ? 148 + Math.max(0, captionLines.length - 1) * 48 : 0);

  return {
    ...source,
    caption,
    showCover,
    showParticipants,
    showCaption,
    menuRows,
    participantRows,
    captionLines,
    height
  };
}
