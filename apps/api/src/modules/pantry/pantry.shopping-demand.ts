import type { RecipeAmountSnapshot } from "../../contracts/types";

export interface ShoppingDemandSource {
  sourceId: number;
  sourceTitle: string;
  scheduledAt: Date;
  updatedAt: Date;
  recipeTitle: string;
  recipeId: number | null;
  sourceVersionId: number;
  baseServings: number;
  ingredientSort: number;
  ingredientId: number | null;
  ingredientName: string;
  amount: RecipeAmountSnapshot;
}

export interface ShoppingDemandEvent {
  sourceId: number;
  title: string;
  scheduledAt: Date;
  recipeTitles: string[];
}

export interface ShoppingDemandLine {
  sourceKey: string;
  ingredientId: number | null;
  ingredientName: string;
  amount: RecipeAmountSnapshot;
  quantityText: string;
  sourceCount: number;
  sourceTitles: string[];
  events: ShoppingDemandEvent[];
  sourceId: number;
  sourceTitle: string;
  scheduledAt: Date;
  updatedAt: Date;
  recipeId: number | null;
  sourceVersionId: number;
  recipeTitle: string;
  baseServings: number;
  ingredientSort: number;
  sourceFacts: ShoppingDemandSource[];
}

export function parseShoppingSourceId(sourceKey: string | null | undefined): number | null {
  const firstPart = sourceKey?.split(":")[0] ?? "";
  const sourceId = Number(firstPart);
  return Number.isInteger(sourceId) && sourceId > 0 ? sourceId : null;
}

export function buildShoppingDemandFactKey(lineSourceKey: string, source: ShoppingDemandSource) {
  const scopedKey = lineSourceKey.startsWith(`${source.sourceId}:`)
    ? lineSourceKey
    : `${source.sourceId}:${lineSourceKey}`;
  return `${scopedKey}:r${source.recipeId ?? "x"}:v${source.sourceVersionId}:i${source.ingredientSort}`;
}

function decimal(value: string) {
  const [integer, fraction] = value.split(".");
  if (!fraction) return BigInt(integer);
  const scale = 10n ** BigInt(fraction.length);
  return BigInt(integer) * scale + BigInt(fraction);
}

function addDecimal(left: string, right: string) {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const scale = Math.max(leftParts[1]?.length ?? 0, rightParts[1]?.length ?? 0);
  const factor = 10n ** BigInt(scale);
  const leftValue = decimal(left) * factor / 10n ** BigInt(leftParts[1]?.length ?? 0);
  const rightValue = decimal(right) * factor / 10n ** BigInt(rightParts[1]?.length ?? 0);
  const value = leftValue + rightValue;
  if (scale === 0) return value.toString();
  const text = value.toString().padStart(scale + 1, "0");
  return `${text.slice(0, -scale)}.${text.slice(-scale).replace(/0+$/, "")}`.replace(/\.$/, "");
}

function formatAmount(amount: RecipeAmountSnapshot) {
  return amount.kind === "FUZZY" ? amount.text : `${amount.quantity}${amount.unitName}`;
}

function ingredientKey(source: ShoppingDemandSource) {
  return source.ingredientId === null
    ? `name:${source.ingredientName.trim().toLowerCase()}`
    : `ingredient:${source.ingredientId}`;
}

function appendSource(line: ShoppingDemandLine, source: ShoppingDemandSource) {
  line.sourceFacts.push(source);
  line.sourceCount += 1;
  if (!line.sourceTitles.includes(source.recipeTitle)) {
    line.sourceTitles.push(source.recipeTitle);
  }
  const event = line.events.find(item => item.sourceId === source.sourceId);
  if (event) {
    if (source.recipeTitle && !event.recipeTitles.includes(source.recipeTitle)) {
      event.recipeTitles.push(source.recipeTitle);
    }
    return;
  }
  line.events.push({
    sourceId: source.sourceId,
    title: source.sourceTitle,
    scheduledAt: source.scheduledAt,
    recipeTitles: source.recipeTitle ? [source.recipeTitle] : []
  });
}

export function buildShoppingDemandLines(sources: ShoppingDemandSource[], scopeKey?: string): ShoppingDemandLine[] {
  const groups = new Map<string, ShoppingDemandLine>();
  const prefix = scopeKey ? `${scopeKey}:` : "";

  for (const source of sources) {
    const keyBase = `${prefix}${ingredientKey(source)}`;
    const sourceKey = source.amount.kind === "EXACT"
      ? `${keyBase}:EXACT:${source.amount.unitId}`
      : `${keyBase}:FUZZY:${source.amount.text}:${source.sourceId}:v${source.sourceVersionId}:${source.ingredientSort}`;
    const current = groups.get(sourceKey);
    if (current) {
      if (current.amount.kind === "EXACT" && source.amount.kind === "EXACT") {
        current.amount = {
          ...current.amount,
          quantity: addDecimal(current.amount.quantity, source.amount.quantity)
        };
        current.quantityText = formatAmount(current.amount);
      }
      appendSource(current, source);
      if (source.updatedAt > current.updatedAt) current.updatedAt = source.updatedAt;
      continue;
    }

    const line: ShoppingDemandLine = {
      sourceKey,
      ingredientId: source.ingredientId,
      ingredientName: source.ingredientName,
      amount: { ...source.amount },
      quantityText: formatAmount(source.amount),
      sourceCount: 1,
      sourceTitles: source.recipeTitle ? [source.recipeTitle] : [],
      events: [{
        sourceId: source.sourceId,
        title: source.sourceTitle,
        scheduledAt: source.scheduledAt,
        recipeTitles: source.recipeTitle ? [source.recipeTitle] : []
      }],
      sourceId: source.sourceId,
      sourceTitle: source.sourceTitle,
      scheduledAt: source.scheduledAt,
      updatedAt: source.updatedAt,
      recipeId: source.recipeId,
      sourceVersionId: source.sourceVersionId,
      recipeTitle: source.recipeTitle,
      baseServings: source.baseServings,
      ingredientSort: source.ingredientSort,
      sourceFacts: [source]
    };
    groups.set(sourceKey, line);
  }

  return [...groups.values()];
}
