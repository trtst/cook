import type { UUID } from "@/apis/http";
import { recipeApi } from "@/apis/recipe";

export interface FridgeImageTarget {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getExpireDiffDays(value: string | null) {
  const expireDate = parseDate(value);
  if (!expireDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expireDate.getTime() - today.getTime()) / 86_400_000);
}

export function isExpiringSoon(value: string | null, days = 3) {
  const diff = getExpireDiffDays(value);
  return diff !== null && diff <= days;
}

export function formatExpireLabel(value: string | null) {
  const diff = getExpireDiffDays(value);
  if (diff === null) return "未设置到期时间";
  if (diff < 0) return `已过期 ${Math.abs(diff)} 天`;
  if (diff === 0) return "今天到期";
  if (diff === 1) return "明天到期";
  return `${diff} 天后到期`;
}

export function buildIngredientAvatarText(name: string) {
  return (name || "食").trim().slice(0, 1) || "食";
}

export async function resolveFridgeImageMap(items: FridgeImageTarget[], limit = 12) {
  const grouped = new Map<string, FridgeImageTarget[]>();

  items.forEach(item => {
    const trimmedName = item.name.trim();
    if (!trimmedName) return;
    const key = item.ingredientId ? `id:${item.ingredientId}` : `name:${trimmedName}`;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  });

  const entries = [...grouped.entries()].slice(0, limit);
  const imageMap: Record<string, string> = {};

  await Promise.all(
    entries.map(async ([, group]) => {
      const first = group[0];
      try {
        const result = await recipeApi.listIngredients({
          page: 1,
          pageSize: 20,
          keyword: first.name.trim(),
          source: "ALL"
        });
        const match =
          result.items.find(candidate => first.ingredientId && candidate.id === first.ingredientId) ??
          result.items.find(candidate => candidate.name === first.name);
        if (!match?.imageUrl) return;
        group.forEach(item => {
          imageMap[String(item.id)] = match.imageUrl as string;
        });
      } catch {
        // 图片补全是弱依赖，不阻塞页面主数据。
      }
    })
  );

  return imageMap;
}
