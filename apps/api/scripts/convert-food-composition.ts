import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const input = resolve(process.argv[2] ?? "../../../../Downloads/food_composition_full.csv");
const output = resolve(process.argv[3] ?? "../data/nutrition/food_composition_primary.csv");
const fields = ["category", "foodCode", "foodName", "englishName", "edible", "energyKCal", "protein", "fat", "CHO"];

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvCell(value: string) {
  return /[,"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function main() {
  const rows = parseCsv(await readFile(input, "utf8").then(text => text.replace(/^\uFEFF/, "")));
  const header = rows.shift() ?? [];
  const index = new Map(header.map((name, position) => [name, position]));
  for (const field of fields) if (!index.has(field)) throw new Error(`CSV 缺少字段: ${field}`);
  const outputRows = [fields.join(","), ...rows.map(row => fields.map(field => csvCell(row[index.get(field)!] ?? "")).join(","))];
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${outputRows.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ input, output, rows: rows.length, fields }));
}

void main();
