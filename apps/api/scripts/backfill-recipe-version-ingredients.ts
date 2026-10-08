import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const batchSize = 500;

async function main() {
  // 按版本 ID 分批扫描历史正文，避免一次性加载全部 JSON 内容。
  let cursorId = 0;
  let scanned = 0;
  let linked = 0;
  let created = 0;

  while (true) {
    const versions = await prisma.recipeContentVersion.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, ingredientsJson: true }
    });
    if (!versions.length) break;

    const rows = new Map<string, { recipeVersionId: number; ingredientId: number }>();
    for (const version of versions) {
      cursorId = version.id;
      scanned += 1;
      if (!Array.isArray(version.ingredientsJson)) continue;
      for (const item of version.ingredientsJson) {
        if (typeof item !== "object" || item === null || !("ingredientId" in item)) continue;
        const ingredientId = Number(item.ingredientId);
        if (!Number.isInteger(ingredientId) || ingredientId <= 0) continue;
        rows.set(`${version.id}:${ingredientId}`, { recipeVersionId: version.id, ingredientId });
      }
    }

    const candidates = Array.from(rows.values());
    const ingredientIds = Array.from(new Set(candidates.map(item => item.ingredientId)));
    const existingIds = new Set(ingredientIds.length
      ? (await prisma.ingredient.findMany({ where: { id: { in: ingredientIds } }, select: { id: true } })).map(item => item.id)
      : []);
    const links = candidates.filter(item => existingIds.has(item.ingredientId));
    linked += links.length;
    if (apply && links.length) {
      const result = await prisma.recipeVersionIngredient.createMany({ data: links, skipDuplicates: true });
      created += result.count;
      console.log(`Created ${result.count} links through recipe version ${cursorId}`);
    }
    if (!apply) console.log(`Would link ${links.length} rows through recipe version ${cursorId}`);
  }

  console.log(`${apply ? `Created ${created}` : `Would create ${linked}`} links across ${scanned} recipe versions${apply ? "" : " (run with --apply to write)"}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
