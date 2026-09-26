export type FridgeTraceKind = "PURCHASED" | "USED" | "MANUAL_PRESENT" | "MANUAL_EMPTY";

export type FridgePresenceStatus = "PRESENT" | "EMPTY" | "UNCONFIRMED";

export interface FridgePresenceRecord {
  kind: FridgeTraceKind;
  createdAt: Date;
  categoryName: string | null;
  categoryCode: string | null;
}

export interface FridgePresenceState {
  status: FridgePresenceStatus;
  updatedAt: string;
  windowDays: 7 | 15;
  archived: boolean;
  recentlyPurchased: boolean;
}

const sevenDayCategoryNames = new Set([
  "蔬菜",
  "水果",
  "鲜肉",
  "鲜鱼",
  "豆制品",
  "鲜奶"
]);

const sevenDayCategoryCodes = new Set([
  "PRODUCE",
  "VEGETABLES",
  "FRUIT",
  "FRESH_MEAT",
  "FRESH_FISH",
  "TOFU",
  "FRESH_MILK"
]);

export function fridgeTraceWindowDays(categoryName: string | null, categoryCode: string | null = null) {
  return categoryName && sevenDayCategoryNames.has(categoryName)
    || categoryCode && sevenDayCategoryCodes.has(categoryCode)
    ? 7
    : 15;
}

export function isFridgeTraceVisible(
  createdAt: Date,
  categoryName: string | null,
  now = new Date(),
  categoryCode: string | null = null
) {
  const windowMs = fridgeTraceWindowDays(categoryName, categoryCode) * 24 * 60 * 60 * 1000;
  return now.getTime() - createdAt.getTime() < windowMs;
}

export function fridgePresenceState(
  records: FridgePresenceRecord[],
  now = new Date()
): FridgePresenceState | null {
  const stateRecords = records
    .filter(record => record.kind !== "USED")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const latest = stateRecords[0];
  if (!latest) return null;

  const latestPurchase = stateRecords.find(record => record.kind === "PURCHASED");
  const windowDays = fridgeTraceWindowDays(latest.categoryName, latest.categoryCode) as 7 | 15;
  const ageMs = now.getTime() - latest.createdAt.getTime();
  const purchaseAgeMs = latestPurchase ? now.getTime() - latestPurchase.createdAt.getTime() : Infinity;
  const confirmed = ageMs < windowDays * 24 * 60 * 60 * 1000;
  return {
    status: !confirmed ? "UNCONFIRMED" : latest.kind === "MANUAL_EMPTY" ? "EMPTY" : "PRESENT",
    updatedAt: latest.createdAt.toISOString(),
    windowDays,
    archived: ageMs >= 30 * 24 * 60 * 60 * 1000,
    recentlyPurchased: purchaseAgeMs < 3 * 24 * 60 * 60 * 1000
  };
}

export function fridgePresentIngredientIds(
  records: Array<FridgePresenceRecord & { ingredientId: number | null }>,
  now = new Date()
) {
  const grouped = new Map<number, FridgePresenceRecord[]>();
  for (const record of records) {
    if (record.ingredientId === null) continue;
    const bucket = grouped.get(record.ingredientId) ?? [];
    bucket.push(record);
    grouped.set(record.ingredientId, bucket);
  }
  const present = new Set<number>();
  for (const [ingredientId, facts] of grouped) {
    if (fridgePresenceState(facts, now)?.status === "PRESENT") present.add(ingredientId);
  }
  return present;
}

export function fridgeTraceLabel(kind: FridgeTraceKind) {
  switch (kind) {
    case "PURCHASED":
      return "最近买过，可能有";
    case "USED":
      return "用过，余量未知";
    case "MANUAL_PRESENT":
      return "手动标记还有";
    case "MANUAL_EMPTY":
      return "手动标记用完";
  }
}
