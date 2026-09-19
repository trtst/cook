export type TasteQuickProfile = {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
};

export type TasteQuickItem = {
  key: string;
  label: string;
};

export type TasteQuickGroup = {
  key: string;
  title: string;
  items: TasteQuickItem[];
};

const tasteGroups = [
  { key: "allergies", title: "过敏" },
  { key: "strictDislikes", title: "严格忌口" },
  { key: "dislikedIngredients", title: "不喜欢食材" },
  { key: "flavorPreferences", title: "口味偏好" }
] as const;

function splitTasteText(value: string | null | undefined) {
  return (value ?? "")
    .split(/[;；]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function buildTasteQuickGroups(profile: TasteQuickProfile): TasteQuickGroup[] {
  return tasteGroups.map(group => ({
    key: group.key,
    title: group.title,
    items: Array.from(new Set(profile[group.key].map(item => item.trim()).filter(Boolean))).map(label => ({
      key: `${group.key}:${label}`,
      label
    }))
  }));
}

export function appendTasteTag(current: string, label: string) {
  const nextLabel = label.trim();
  if (!nextLabel) return current.trim();
  const items = splitTasteText(current);
  if (items.includes(nextLabel)) return items.join("；");
  return [...items, nextLabel].join("；");
}
