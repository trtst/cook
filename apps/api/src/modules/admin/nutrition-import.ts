export interface NutritionCsvRow {
  category: string;
  foodCode: string;
  foodName: string;
  englishName: string;
  edible: number | null;
  energyKCal: number | null;
  protein: number | null;
  fat: number | null;
  CHO: number | null;
  raw: Record<typeof fields[number], string>;
}

const fields = ["category", "foodCode", "foodName", "englishName", "edible", "energyKCal", "protein", "fat", "CHO"] as const;
const emptyMarkers = new Set(["", "—", "Tr", "tr"]);

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseNumber(value: string, line: number, field: string) {
  const text = value.trim();
  if (emptyMarkers.has(text)) return null;
  const normalized = text.endsWith("*") ? text.slice(0, -1).trim() : text;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`第 ${line} 行 ${field} 数值无效: ${text}`);
  return number;
}

export function parseNutritionCsvText(text: string): NutritionCsvRow[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = rows.shift() ?? [];
  const index = new Map(header.map((name, position) => [name.trim(), position]));
  for (const field of fields) if (!index.has(field)) throw new Error(`CSV 缺少字段: ${field}`);
  if (rows.length === 0) throw new Error("CSV 至少包含一条数据");

  const foodCodes = new Set<string>();
  return rows.map((row, rowIndex) => {
    const line = rowIndex + 2;
    const value = (field: string) => row[index.get(field) ?? -1]?.trim() ?? "";
    const category = value("category");
    const foodCode = value("foodCode");
    const foodName = value("foodName");
    if (!category) throw new Error(`第 ${line} 行 category 不能为空`);
    if (!foodCode) throw new Error(`第 ${line} 行 foodCode 不能为空`);
    if (foodCodes.has(foodCode)) throw new Error(`第 ${line} 行 foodCode 重复: ${foodCode}`);
    if (!foodName) throw new Error(`第 ${line} 行 foodName 不能为空`);
    foodCodes.add(foodCode);
    const englishName = value("englishName");
    const edible = value("edible");
    const energyKCal = value("energyKCal");
    const protein = value("protein");
    const fat = value("fat");
    const CHO = value("CHO");
    return {
      category,
      foodCode,
      foodName,
      englishName,
      edible: parseNumber(edible, line, "edible"),
      energyKCal: parseNumber(energyKCal, line, "energyKCal"),
      protein: parseNumber(protein, line, "protein"),
      fat: parseNumber(fat, line, "fat"),
      CHO: parseNumber(CHO, line, "CHO"),
      raw: { category, foodCode, foodName, englishName, edible, energyKCal, protein, fat, CHO }
    };
  });
}
